# ERV Versand client

The connection to the Basisdienst: ERV Versand. The app uses it on the server, as an alternative to
e-mail, to send messages through the electronic legal transport (ERV) to a participant's SAFE-ID.
The binding specification is
[`api/example-client.asyncapi.yaml`](https://github.com/digitalservicebund/a2j-basisdienst-erv-versand/blob/main/api/example-client.asyncapi.yaml)
on `main` of the Basisdienst repository, with the schemas in `api/schemas/`.

- [`erv-versand-messages.ts`](./erv-versand-messages.ts): payload types for all request and reply
  messages, written by hand after the Basisdienst's schemas, which remain the source of truth. As
  supplied by the Basisdienst team, apart from formatting.
- [`erv-versand-client.ts`](./erv-versand-client.ts): publishes requests and consumes the replies,
  on top of an AMQP confirm channel. Based on the request-reply client of the Basisdienst team, but
  asynchronous (see below).
- [`erv-versand-connection.ts`](./erv-versand-connection.ts): the one connection per process,
  started with the server (`startBackgroundWork()` in `app/app.ts`). It reconnects by itself.

## Why asynchronous

The Basisdienst team's client keeps pending requests in memory and waits for each reply. That fails
as soon as two clients consume the same reply queue `replies.<userId>`, which happens with two
concurrent requests or two app instances: RabbitMQ hands the replies to the consumers in turn, so
a client can get another one's reply, and its own request times out although it went out.

This client does not wait. The caller chooses the correlation ID and stores it before publishing
(the ERV invitation is recorded as pending). Every reply goes to `onReply`, at whichever instance it
arrives, which settles the stored invitation with the same correlation ID. A reply is acknowledged
once it was handled; if handling fails, it is offered once more, then dropped.

## Usage

```typescript
import { ervVersandClient, startErvVersand } from "../infra/erv-versand/erv-versand-connection.ts";

// Once, when the server starts:
startErvVersand(async (reply) => {
  // reply.outcome is "sent", "failed" (with an RFC 9457 problem) or "unreadable"
  await settleInvitation(reply.correlationId, reply.outcome);
});

// For every message, after storing the correlation ID:
const client = await ervVersandClient();
await client.sendEgvpMessage(
  {
    receiver: "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740",
    xjustizMessage: { content: base64EncodedXjustizMessage },
  },
  correlationId,
);
```

`sendEgvpMessage` resolves once the broker confirmed the request. Do not log SAFE-IDs or message
contents, only ids (see `app/lib/erv/send-erv-invitation.ts` and `app/lib/erv/erv-replies.ts`).

## Behavior

- Requests go to the `requests` exchange with the native AMQP properties `correlation-id`,
  `user-id`, and `type`. The specification documents them as headers only due to limitations of
  AsyncAPI.
- Replies are consumed from the queue `replies.<userId>`, which the Basisdienst provides.
- A reply is `failed` when its type is one of the failure types or its content type is
  `application/problem+json`, and `unreadable` when its type is unknown or its payload is no JSON.
  Always handle unknown problem types, for forward compatibility.
- If the broker cancels the consumer or the connection drops, the connection is reopened, first
  after one second, then waiting twice as long each time, at most a minute.
