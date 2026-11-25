import { randomUUID } from "node:crypto";

import type {
  EgvpMessageSent,
  SendEgvpExampleMessage,
  SendEgvpMessage,
  SendEgvpMessageFailed,
} from "./erv-versand-messages.ts";

export async function createErvVersandClient(
  options: ErvVersandClientOptions,
): Promise<ErvVersandClient> {
  const { channel, userId, onUncorrelatedReply } = options;
  const timeoutInMilliseconds = options.timeoutInMilliseconds ?? DEFAULT_TIMEOUT_IN_MILLISECONDS;
  const pendingRequests = new Map<string, PendingRequest>();

  const { consumerTag } = await channel.consume(
    `${REPLY_QUEUE_PREFIX}${userId}`,
    (message) => {
      if (message === null) {
        rejectAll(pendingRequests, new Error("Reply queue consumer was cancelled by the broker."));
        return;
      }

      handleReply(message, pendingRequests, onUncorrelatedReply);
      channel.ack(message);
    },
    { noAck: false },
  );

  return {
    sendEgvpMessage: (payload) =>
      sendRequest(MESSAGE_TYPES.sendEgvpMessage, payload) as Promise<
        SendResult<SendEgvpMessageFailed>
      >,

    sendEgvpExampleMessage: (payload) =>
      sendRequest(MESSAGE_TYPES.sendEgvpExampleMessage, payload) as Promise<
        SendResult<SendEgvpMessageFailed>
      >,

    async close() {
      await channel.cancel(consumerTag);
      rejectAll(pendingRequests, new Error("ERV Versand client was closed."));
    },
  };

  function sendRequest(messageType: string, payload: object): Promise<SendResult<unknown>> {
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(correlationId);
        reject(
          new ErvVersandTimeoutError(
            `No reply for ${messageType} (correlation ID ${correlationId}) within ${timeoutInMilliseconds} ms.`,
            correlationId,
          ),
        );
      }, timeoutInMilliseconds);

      pendingRequests.set(correlationId, { resolve, reject, timeout });

      channel.publish(REQUEST_EXCHANGE, REQUEST_ROUTING_KEY, Buffer.from(JSON.stringify(payload)), {
        // Native AMQP properties, NOT headers. The specification documents
        // them as headers only due to limitations of AsyncAPI.
        correlationId,
        userId,
        type: messageType,
        contentType: "application/json",
        persistent: true,
      });
    });
  }
}

export type ErvVersandClient = {
  /** Sends an EGVP message directly to a receiver. */
  sendEgvpMessage(payload: SendEgvpMessage): Promise<SendResult<SendEgvpMessageFailed>>;

  /**
   * Sends a static example message without attachments. Intended for first
   * client integration tests.
   */
  sendEgvpExampleMessage(
    payload: SendEgvpExampleMessage,
  ): Promise<SendResult<SendEgvpMessageFailed>>;

  /** Stops consuming replies and rejects all pending requests. */
  close(): Promise<void>;
};

/**
 * Outcome of a request. Domain failures resolve as `failed` with an RFC 9457
 * problem. The promise only rejects on technical errors (timeout, client
 * closed, unparsable reply).
 */
export type SendResult<Problem> =
  | { outcome: "sent"; reply: EgvpMessageSent }
  | { outcome: "failed"; problem: Problem };

export type ErvVersandClientOptions = {
  /** AMQP channel of a connection authenticated as `userId` */
  channel: AmqpChannel;

  /**
   * User of the AMQP connection. The broker verifies the `user-id` property
   * against it, and replies are routed to the queue `replies.<userId>`.
   */
  userId: string;

  /**
   * Called for replies without a matching pending request. That happens after
   * a restart or timeout, or when several instances share the same reply queue.
   * The reply gets acknowledged afterwards, so persist it here if needed.
   */
  onUncorrelatedReply: (reply: UncorrelatedReply) => void;

  /** Defaults to 5 minutes. */
  timeoutInMilliseconds?: number;
};

export type UncorrelatedReply = {
  correlationId: string | undefined;
  messageType: string | undefined;
  payload: unknown;
};

export class ErvVersandTimeoutError extends Error {
  readonly correlationId: string;

  constructor(message: string, correlationId: string) {
    super(message);
    this.name = "ErvVersandTimeoutError";
    this.correlationId = correlationId;
  }
}

/**
 * The minimal subset of an AMQP channel used by the client. The promise based
 * `Channel` and `ConfirmChannel` of `amqplib` satisfy it structurally.
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
  consume(
    queue: string,
    onMessage: (message: AmqpMessage | null) => void,
    options: { noAck: boolean },
  ): Promise<{ consumerTag: string }>;
  cancel(consumerTag: string): Promise<unknown>;
  ack(message: AmqpMessage): void;
};

export type AmqpMessage = {
  content: Buffer;
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
const REPLY_QUEUE_PREFIX = "replies.";
const DEFAULT_TIMEOUT_IN_MILLISECONDS = 5 * 60 * 1000;

const FAILURE_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  MESSAGE_TYPES.sendEgvpMessageFailed,
  MESSAGE_TYPES.sendEgvpExampleMessageFailed,
]);

type PendingRequest = {
  resolve: (result: SendResult<unknown>) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

function handleReply(
  message: AmqpMessage,
  pendingRequests: Map<string, PendingRequest>,
  onUncorrelatedReply: (reply: UncorrelatedReply) => void,
): void {
  const { correlationId, type: messageType } = message.properties;
  const pendingRequest =
    correlationId === undefined ? undefined : pendingRequests.get(correlationId);

  let payload: unknown;
  try {
    payload = JSON.parse(message.content.toString("utf8"));
  } catch (error) {
    if (pendingRequest === undefined) {
      onUncorrelatedReply({
        correlationId,
        messageType,
        payload: message.content.toString("utf8"),
      });
    } else {
      settle(pendingRequests, correlationId!, pendingRequest);
      pendingRequest.reject(new Error("Reply payload is not valid JSON.", { cause: error }));
    }
    return;
  }

  if (pendingRequest === undefined) {
    onUncorrelatedReply({ correlationId, messageType, payload });
    return;
  }

  settle(pendingRequests, correlationId!, pendingRequest);

  if (messageType === MESSAGE_TYPES.egvpMessageSent) {
    pendingRequest.resolve({
      outcome: "sent",
      reply: payload as EgvpMessageSent,
    });
  } else if (
    (messageType !== undefined && FAILURE_MESSAGE_TYPES.has(messageType)) ||
    message.properties.contentType === "application/problem+json"
  ) {
    pendingRequest.resolve({ outcome: "failed", problem: payload });
  } else {
    pendingRequest.reject(new Error(`Unexpected reply message type: ${messageType}`));
  }
}

function settle(
  pendingRequests: Map<string, PendingRequest>,
  correlationId: string,
  pendingRequest: PendingRequest,
): void {
  clearTimeout(pendingRequest.timeout);
  pendingRequests.delete(correlationId);
}

function rejectAll(pendingRequests: Map<string, PendingRequest>, error: Error): void {
  for (const [correlationId, pendingRequest] of pendingRequests) {
    settle(pendingRequests, correlationId, pendingRequest);
    pendingRequest.reject(error);
  }
}
