import type {
  EgvpMessageSent,
  SendEgvpExampleMessage,
  SendEgvpMessage,
  SendEgvpMessageFailed,
} from "./erv-versand-messages.ts";

/**
 * Creates a client for the Basisdienst: ERV Versand on top of an existing AMQP confirm channel (for
 * example an `amqplib` `ConfirmChannel`). It starts consuming the client's reply queue
 * `replies.<userId>` right away and hands every reply to `onReply`.
 *
 * Unlike the request-reply client of the Basisdienst team, it does not wait for replies in memory:
 * the caller chooses the correlation ID, keeps it (in the database), and matches the reply in
 * `onReply`. So a reply is handled wherever it arrives, also at another instance that shares the
 * reply queue or after a restart.
 */
export async function createErvVersandClient(
  options: ErvVersandClientOptions,
): Promise<ErvVersandClient> {
  const { channel, userId, onReply, onCancel } = options;

  const { consumerTag } = await channel.consume(
    replyQueueName(userId),
    (message) => {
      if (message === null) {
        onCancel?.();
        return;
      }
      // Acknowledged once handled. A reply that could not be handled is offered once more, then
      // dropped, so a reply that always fails cannot block the queue.
      onReply(readReply(message)).then(
        () => channel.ack(message),
        () => channel.nack(message, false, !message.fields.redelivered),
      );
    },
    { noAck: false },
  );

  async function publish(messageType: string, payload: object, correlationId: string) {
    channel.publish(REQUEST_EXCHANGE, REQUEST_ROUTING_KEY, Buffer.from(JSON.stringify(payload)), {
      // Native AMQP properties, NOT headers. The specification documents them as headers only due
      // to limitations of AsyncAPI.
      correlationId,
      userId,
      type: messageType,
      contentType: "application/json",
      persistent: true,
    });
    // The broker has taken over the request, so it is not lost if this process stops.
    await channel.waitForConfirms();
  }

  return {
    sendEgvpMessage: (payload, correlationId) =>
      publish(MESSAGE_TYPES.sendEgvpMessage, payload, correlationId),
    sendEgvpExampleMessage: (payload, correlationId) =>
      publish(MESSAGE_TYPES.sendEgvpExampleMessage, payload, correlationId),
    async close() {
      await channel.cancel(consumerTag);
    },
  };
}

export type ErvVersandClient = {
  /**
   * Sends an EGVP message directly to a receiver. Resolves once the broker confirmed the request;
   * the reply comes later through `onReply` with the same correlation ID.
   */
  sendEgvpMessage(payload: SendEgvpMessage, correlationId: string): Promise<void>;

  /**
   * Sends a static example message without attachments. Intended for first client integration
   * tests.
   */
  sendEgvpExampleMessage(payload: SendEgvpExampleMessage, correlationId: string): Promise<void>;

  /** Stops consuming replies. */
  close(): Promise<void>;
};

export type ErvVersandClientOptions = {
  /** AMQP confirm channel of a connection authenticated as `userId` */
  channel: AmqpChannel;

  /**
   * User of the AMQP connection. The broker verifies the `user-id` property against it, and
   * replies are routed to the queue `replies.<userId>`.
   */
  userId: string;

  /**
   * Called for every reply. The reply is acknowledged once the promise resolves. If it rejects,
   * the reply is offered once more, then dropped.
   */
  onReply: (reply: ErvVersandReply) => Promise<void>;

  /** Called when the broker cancels the consumer, for example because the queue was deleted. */
  onCancel?: () => void;
};

/**
 * A reply of the Basisdienst. Domain failures come as `failed` with an RFC 9457 problem. A reply
 * of an unknown type or with a payload that is no JSON is `unreadable`.
 */
export type ErvVersandReply = {
  correlationId: string | undefined;
  messageType: string | undefined;
  outcome:
    | { kind: "sent"; reply: EgvpMessageSent }
    | { kind: "failed"; problem: SendEgvpMessageFailed }
    | { kind: "unreadable"; reason: string };
};

/**
 * The minimal subset of an AMQP confirm channel used by the client. The promise based
 * `ConfirmChannel` of `amqplib` satisfies it structurally.
 */
export type AmqpChannel = {
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: {
      correlationId: string;
      userId: string;
      type: string;
      contentType: string;
      persistent: boolean;
    },
  ): boolean;
  waitForConfirms(): Promise<void>;
  consume(
    queue: string,
    onMessage: (message: AmqpMessage | null) => void,
    options: { noAck: boolean },
  ): Promise<{ consumerTag: string }>;
  cancel(consumerTag: string): Promise<unknown>;
  ack(message: AmqpMessage): void;
  nack(message: AmqpMessage, allUpTo: boolean, requeue: boolean): void;
};

export type AmqpMessage = {
  content: Buffer;
  fields: { redelivered: boolean };
  properties: {
    correlationId?: string;
    type?: string;
    contentType?: string;
  };
};

export const MESSAGE_TYPES = {
  sendEgvpMessage: "de.justiz.basisdienst.erv.send-egvp-message.v1",
  sendEgvpExampleMessage: "de.justiz.basisdienst.erv.send-egvp-example-message.v1",
  egvpMessageSent: "de.justiz.basisdienst.erv.egvp-message-sent.v1",
  sendEgvpMessageFailed: "de.justiz.basisdienst.erv.send-egvp-message-failed.v1",
  sendEgvpExampleMessageFailed: "de.justiz.basisdienst.erv.send-egvp-example-message-failed.v1",
} as const;

const REQUEST_EXCHANGE = "requests";
const REQUEST_ROUTING_KEY = "requests";

/** The queue the Basisdienst routes the replies to this AMQP user's requests to. */
export const replyQueueName = (userId: string) => `replies.${userId}`;

const FAILURE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  MESSAGE_TYPES.sendEgvpMessageFailed,
  MESSAGE_TYPES.sendEgvpExampleMessageFailed,
]);

function readReply(message: AmqpMessage): ErvVersandReply {
  const { correlationId, type: messageType, contentType } = message.properties;
  const reply = (outcome: ErvVersandReply["outcome"]) => ({ correlationId, messageType, outcome });

  let payload: unknown;
  try {
    payload = JSON.parse(message.content.toString("utf8"));
  } catch {
    return reply({ kind: "unreadable", reason: "Reply payload is not valid JSON." });
  }

  if (messageType === MESSAGE_TYPES.egvpMessageSent) {
    return reply({ kind: "sent", reply: payload as EgvpMessageSent });
  }
  if (
    (messageType !== undefined && FAILURE_MESSAGE_TYPES.has(messageType)) ||
    contentType === "application/problem+json"
  ) {
    return reply({ kind: "failed", problem: payload as SendEgvpMessageFailed });
  }
  return reply({ kind: "unreadable", reason: `Unexpected reply message type: ${messageType}` });
}
