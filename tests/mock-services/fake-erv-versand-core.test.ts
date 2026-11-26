// @vitest-environment node
import { describe, expect, it } from "vitest";

import { MESSAGE_TYPES } from "../../app/lib/infra/erv-versand/erv-versand-client.ts";
import {
  PAYLOAD_INVALID_TYPE,
  RECEIVER_UNKNOWN_TYPE,
} from "../../app/lib/infra/erv-versand/erv-versand-messages.ts";
import {
  answer,
  MESSAGE_LIMIT,
  MessageStore,
  parsePayload,
  receivedMessage,
  route,
} from "./fake-erv-versand-core.ts";

const SAFE_ID = "DE.Example.00000000-0000-4000-8000-000000000001.0001";
const OTHER_SAFE_ID = "DE.Example.00000000-0000-4000-8000-000000000002.0002";
const UNKNOWN_SAFE_ID = "DE.Example.00000000-0000-0000-0000-000000000000.0000";
const base64 = (value: string) => Buffer.from(value).toString("base64");

const egvpMessage = {
  receiver: SAFE_ID,
  xjustizMessage: { content: base64("<xml/>") },
  attachments: [{ name: "Nachrichtentext.pdf", content: base64("%PDF-test") }],
};
const now = new Date("2026-11-25T10:00:00Z");

const received = (correlationId: string, receiver = SAFE_ID) =>
  receivedMessage(
    { correlationId, userId: "jts", type: MESSAGE_TYPES.sendEgvpMessage },
    { ...egvpMessage, receiver },
    answer(MESSAGE_TYPES.sendEgvpMessage, egvpMessage),
    now,
  );

const url = (path: string) => new URL(path, "http://localhost");

describe("answer", () => {
  it("sends a valid EGVP message and the example message", () => {
    const sent = {
      type: MESSAGE_TYPES.egvpMessageSent,
      contentType: "application/json",
      payload: {},
    };

    expect(answer(MESSAGE_TYPES.sendEgvpMessage, egvpMessage)).toEqual(sent);
    expect(answer(MESSAGE_TYPES.sendEgvpExampleMessage, { receiver: SAFE_ID })).toEqual(sent);
  });

  it("does not know the SAFE-ID with the all-zero UUID", () => {
    expect(
      answer(MESSAGE_TYPES.sendEgvpMessage, { ...egvpMessage, receiver: UNKNOWN_SAFE_ID }),
    ).toEqual({
      type: MESSAGE_TYPES.sendEgvpMessageFailed,
      contentType: "application/problem+json",
      payload: { type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown" },
    });
  });

  it("points at every invalid part of the payload", () => {
    const reply = answer(MESSAGE_TYPES.sendEgvpMessage, {
      receiver: "DE.Example.1",
      xjustizMessage: {},
      attachments: [{ name: "", content: base64("x") }, { name: "b.pdf" }],
    });

    expect(reply).toMatchObject({
      type: MESSAGE_TYPES.sendEgvpMessageFailed,
      payload: {
        type: PAYLOAD_INVALID_TYPE,
        errors: [
          { pointer: "#/receiver" },
          { pointer: "#/xjustizMessage/content" },
          { pointer: "#/attachments/0/name" },
          { pointer: "#/attachments/1/content" },
        ],
      },
    });
  });

  it("answers a failed example message with its own type", () => {
    expect(answer(MESSAGE_TYPES.sendEgvpExampleMessage, {})).toMatchObject({
      type: MESSAGE_TYPES.sendEgvpExampleMessageFailed,
    });
  });

  it("does not answer an unknown or missing message type", () => {
    expect(answer("unknown.v1", egvpMessage)).toBeUndefined();
    expect(answer(undefined, egvpMessage)).toBeUndefined();
  });
});

describe("parsePayload", () => {
  it("reads a JSON object and falls back to an empty payload", () => {
    expect(parsePayload(Buffer.from(JSON.stringify(egvpMessage)))).toEqual(egvpMessage);
    expect(parsePayload(Buffer.from("not json"))).toEqual({});
    expect(parsePayload(Buffer.from("null"))).toEqual({});
  });
});

describe("receivedMessage", () => {
  it("decodes the XJustiz message and keeps the attachments", () => {
    expect(received("c1")).toEqual({
      receivedAt: "2026-11-25T10:00:00.000Z",
      correlationId: "c1",
      userId: "jts",
      messageType: MESSAGE_TYPES.sendEgvpMessage,
      receiver: SAFE_ID,
      xjustizMessage: "<xml/>",
      attachments: [{ name: "Nachrichtentext.pdf", size: 9, content: base64("%PDF-test") }],
      reply: MESSAGE_TYPES.egvpMessageSent,
    });
  });

  it("keeps what is missing as null", () => {
    expect(receivedMessage({}, {}, undefined, now)).toEqual({
      receivedAt: "2026-11-25T10:00:00.000Z",
      correlationId: null,
      userId: null,
      messageType: null,
      receiver: null,
      xjustizMessage: null,
      attachments: [],
      reply: null,
    });
  });
});

describe("MessageStore", () => {
  it("lists the newest first, for all or one receiver", () => {
    const store = new MessageStore();
    store.add(received("c1"));
    store.add(received("c2", OTHER_SAFE_ID));
    store.add(received("c3"));

    expect(store.list(null).map(({ correlationId }) => correlationId)).toEqual(["c3", "c2", "c1"]);
    expect(store.list(SAFE_ID).map(({ correlationId }) => correlationId)).toEqual(["c3", "c1"]);
  });

  it(`keeps the last ${MESSAGE_LIMIT} requests`, () => {
    const store = new MessageStore();
    for (let index = 0; index <= MESSAGE_LIMIT; index++) store.add(received(`c${index}`));

    expect(store.list(null)).toHaveLength(MESSAGE_LIMIT);
    expect(store.list(null).at(-1)!.correlationId).toBe("c1");
  });

  it("forgets the requests of one receiver or all", () => {
    const store = new MessageStore();
    store.add(received("c1"));
    store.add(received("c2", OTHER_SAFE_ID));

    store.delete(SAFE_ID);
    expect(store.list(null).map(({ correlationId }) => correlationId)).toEqual(["c2"]);
    store.delete(null);
    expect(store.list(null)).toEqual([]);
  });
});

describe("route", () => {
  const store = new MessageStore();
  store.add(received("c1"));
  store.add(received("c2", OTHER_SAFE_ID));

  it("is healthy only once it consumes requests", () => {
    expect(route(store, false, "GET", url("/health")).status).toBe(503);
    expect(route(store, true, "GET", url("/health"))).toMatchObject({
      status: 200,
      body: JSON.stringify({ status: "ok" }, null, 2),
    });
  });

  it("lists the requests as JSON, optionally for one receiver", () => {
    const all = route(store, true, "GET", url("/messages"));
    const one = route(store, true, "GET", url(`/messages?receiver=${SAFE_ID}`));

    expect(all.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(String(all.body)).messages).toHaveLength(2);
    expect(JSON.parse(String(one.body))).toEqual({ messages: [received("c1")] });
  });

  it("serves an attachment as a file", () => {
    const response = route(store, true, "GET", url("/messages/c1/attachments/Nachrichtentext.pdf"));

    expect(response).toEqual({
      status: 200,
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from("%PDF-test"),
    });
  });

  it("answers 404 for an unknown attachment, request or path", () => {
    expect(route(store, true, "GET", url("/messages/c1/attachments/other.pdf")).status).toBe(404);
    expect(
      route(store, true, "GET", url("/messages/c9/attachments/Nachrichtentext.pdf")).status,
    ).toBe(404);
    expect(route(store, true, "GET", url("/other")).status).toBe(404);
    expect(route(store, true, "POST", url("/messages")).status).toBe(404);
  });

  it("forgets requests on DELETE", () => {
    const own = new MessageStore();
    own.add(received("c1"));
    own.add(received("c2", OTHER_SAFE_ID));

    expect(route(own, true, "DELETE", url(`/messages?receiver=${SAFE_ID}`)).status).toBe(204);
    expect(own.list(null).map(({ correlationId }) => correlationId)).toEqual(["c2"]);
    route(own, true, "DELETE", url("/messages"));
    expect(own.list(null)).toEqual([]);
  });
});
