// What the fake Basisdienst: ERV Versand (fake-erv-versand.ts) answers and what its HTTP API shows,
// without RabbitMQ or a server, so it can be tested on its own.
import { MESSAGE_TYPES } from "../../app/lib/infra/erv-versand/erv-versand-client.ts";
import {
  isSafeId,
  PAYLOAD_INVALID_TYPE,
  RECEIVER_UNKNOWN_TYPE,
} from "../../app/lib/infra/erv-versand/erv-versand-messages.ts";

// A SAFE-ID with this UUID is unknown to the fake, to try out the failure path.
export const UNKNOWN_RECEIVER_UUID = "00000000-0000-0000-0000-000000000000";
// How many requests the fake keeps. Older ones are dropped.
export const MESSAGE_LIMIT = 200;

const FAILED_TYPE: Record<string, string> = {
  [MESSAGE_TYPES.sendEgvpMessage]: MESSAGE_TYPES.sendEgvpMessageFailed,
  [MESSAGE_TYPES.sendEgvpExampleMessage]: MESSAGE_TYPES.sendEgvpExampleMessageFailed,
};

export type Reply = { type: string; contentType: string; payload: object };

export type Payload = {
  receiver?: unknown;
  xjustizMessage?: { content?: unknown };
  attachments?: Array<{ name?: unknown; content?: unknown }>;
};

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

// Where the payload breaks the request schema, as JSON Pointers. Checks only what the app sends.
function violations(messageType: string, payload: Payload): string[] {
  const pointers: string[] = [];
  if (typeof payload.receiver !== "string" || !isSafeId(payload.receiver)) {
    pointers.push("#/receiver");
  }
  if (messageType === MESSAGE_TYPES.sendEgvpMessage) {
    if (!nonEmpty(payload.xjustizMessage?.content)) pointers.push("#/xjustizMessage/content");
    for (const [index, attachment] of (payload.attachments ?? []).entries()) {
      if (!nonEmpty(attachment.name)) pointers.push(`#/attachments/${index}/name`);
      if (!nonEmpty(attachment.content)) pointers.push(`#/attachments/${index}/content`);
    }
  }
  return pointers;
}

// The reply the real Basisdienst would send, or none for a message type it does not know.
// - A receiver that is not a SAFE-ID, or an EGVP message without an embedded XJustiz message or with
//   an attachment without a name or content: Payload Invalid. Like the Basisdienst, it does not
//   look into the XJustiz message itself.
// - A SAFE-ID whose UUID is all zeros: Receiver Unknown.
// - Any other SAFE-ID: sent.
export function answer(messageType: string | undefined, payload: Payload): Reply | undefined {
  const failedType = messageType === undefined ? undefined : FAILED_TYPE[messageType];
  if (messageType === undefined || failedType === undefined) return undefined;
  const failed = (problem: object) => ({
    type: failedType,
    contentType: "application/problem+json",
    payload: problem,
  });

  const pointers = violations(messageType, payload);
  if (pointers.length > 0) {
    return failed({
      type: PAYLOAD_INVALID_TYPE,
      title: "Payload Invalid",
      errors: pointers.map((pointer) => ({ pointer, detail: "invalid" })),
    });
  }
  if (String(payload.receiver).split(".")[2] === UNKNOWN_RECEIVER_UUID) {
    return failed({ type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown" });
  }
  return { type: MESSAGE_TYPES.egvpMessageSent, contentType: "application/json", payload: {} };
}

// The JSON body of a request, or an empty payload if it is none.
export function parsePayload(content: Buffer): Payload {
  try {
    const payload: unknown = JSON.parse(content.toString("utf8"));
    return typeof payload === "object" && payload !== null ? payload : {};
  } catch {
    return {};
  }
}

// A request as the HTTP API shows it: the XJustiz message decoded, attachments as Base64.
export type ReceivedMessage = {
  receivedAt: string;
  correlationId: string | null;
  userId: string | null;
  messageType: string | null;
  receiver: string | null;
  xjustizMessage: string | null;
  attachments: Array<{ name: string; size: number; content: string }>;
  // The message type of the reply, null if the request was not answered.
  reply: string | null;
};

type Properties = { correlationId?: string; userId?: string; type?: string };

export function receivedMessage(
  { correlationId, userId, type }: Properties,
  payload: Payload,
  reply: Reply | undefined,
  now: Date,
): ReceivedMessage {
  const content = payload.xjustizMessage?.content;
  return {
    receivedAt: now.toISOString(),
    correlationId: correlationId ?? null,
    userId: userId ?? null,
    messageType: type ?? null,
    receiver: typeof payload.receiver === "string" ? payload.receiver : null,
    xjustizMessage: nonEmpty(content) ? Buffer.from(content, "base64").toString("utf8") : null,
    attachments: (payload.attachments ?? []).flatMap(({ name, content: data }) =>
      nonEmpty(name) && nonEmpty(data)
        ? [{ name, size: Buffer.from(data, "base64").length, content: data }]
        : [],
    ),
    reply: reply?.type ?? null,
  };
}

// The requests the fake received, newest first.
export class MessageStore {
  #messages: ReceivedMessage[] = [];

  add(message: ReceivedMessage): void {
    this.#messages = [message, ...this.#messages].slice(0, MESSAGE_LIMIT);
  }

  list(receiver: string | null): ReceivedMessage[] {
    return receiver === null
      ? this.#messages
      : this.#messages.filter((message) => message.receiver === receiver);
  }

  delete(receiver: string | null): void {
    this.#messages =
      receiver === null ? [] : this.#messages.filter((message) => message.receiver !== receiver);
  }
}

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
};

const json = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body, null, 2),
});

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xml: "application/xml",
};

const ATTACHMENT_PATH = /^\/messages\/([^/]+)\/attachments\/([^/]+)$/;

// The HTTP API, for E2E tests and for looking at what the app sent:
// - GET /health: 200 once the fake consumes requests, 503 before.
// - GET /messages?receiver=<SAFE-ID>: the requests, newest first, optionally for one receiver.
// - DELETE /messages?receiver=<SAFE-ID>: forgets the requests, all or those of one receiver.
// - GET /messages/<correlation ID>/attachments/<name>: one attachment as a file.
export function route(store: MessageStore, ready: boolean, method: string, url: URL): HttpResponse {
  const receiver = url.searchParams.get("receiver");

  if (url.pathname === "/health" && method === "GET") {
    return ready ? json(200, { status: "ok" }) : json(503, { status: "starting" });
  }
  if (url.pathname === "/messages" && method === "GET") {
    return json(200, { messages: store.list(receiver) });
  }
  if (url.pathname === "/messages" && method === "DELETE") {
    store.delete(receiver);
    return { status: 204, headers: {}, body: "" };
  }

  const attachmentPath = ATTACHMENT_PATH.exec(url.pathname);
  if (attachmentPath && method === "GET") {
    const [, correlationId, name] = attachmentPath.map((part) => decodeURIComponent(part));
    const attachment = store
      .list(null)
      .find((message) => message.correlationId === correlationId)
      ?.attachments.find((file) => file.name === name);
    if (!attachment) return json(404, { status: "not found" });
    const extension = name!.split(".").pop()!.toLowerCase();
    return {
      status: 200,
      headers: { "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream" },
      body: Buffer.from(attachment.content, "base64"),
    };
  }

  return json(404, { status: "not found" });
}
