# ERV Versand client

A small, dependency-free client for the request-reply API of the Basisdienst: ERV Versand. The
app uses it on the server, as an alternative to e-mail, to send messages through the electronic
legal transport (ERV) to a participant's SAFE-ID. It was supplied by the Basisdienst team. Apart
from this project's formatting and lint fixes (`type` instead of `interface`), it matches their
copy, so take changes from upstream rather than rewriting it here.

- [`erv-versand-messages.ts`](./erv-versand-messages.ts): payload types for all request and reply
  messages, written by hand after the Basisdienst's specifications. Their schemas remain the source
  of truth.
- [`erv-versand-client.ts`](./erv-versand-client.ts): request-reply client on top of an existing
  AMQP channel, for example one from [`connectRabbitMq()`](../rabbitmq.ts).

## Usage

```typescript
import { createErvVersandClient } from "../infra/erv-versand/erv-versand-client.ts";
import { isPayloadInvalid, isReceiverUnknown } from "../infra/erv-versand/erv-versand-messages.ts";
import { connectRabbitMq } from "../infra/rabbitmq.ts";

const connection = await connectRabbitMq();
const client = await createErvVersandClient({
  channel: await connection.createChannel(),
  userId: "my-service", // user of the AMQP connection
  onUncorrelatedReply: (reply) => logInfo(`Uncorrelated ERV reply ${reply.correlationId}`),
});

const result = await client.sendEgvpMessage({
  receiver: "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740",
  xjustizMessage: { content: base64EncodedXjustizMessage },
});

if (result.outcome === "failed") {
  if (isPayloadInvalid(result.problem)) {
    // fix the payload, see result.problem.errors
  } else if (isReceiverUnknown(result.problem)) {
    // change the receiver
  } else {
    // unknown problem, always handle for forward compatibility
  }
}
```

Do not log SAFE-IDs or message contents, only ids (see `send-erv-invitation.ts`).

## Behavior

- Requests go to the `requests` exchange with the native AMQP properties `correlation-id`,
  `user-id`, and `type`. The specification documents them as headers only due to limitations of
  AsyncAPI.
- Replies are consumed from the queue `replies.<userId>` and matched to pending requests by
  correlation identifier.
- Domain failures resolve with `outcome: "failed"` and an RFC 9457 problem. The promise only
  rejects on technical errors: timeout (default 5 minutes), closed client, or an unparsable reply.
- Pending requests live in memory only. Replies arriving after a restart or timeout, or at another
  instance sharing the same reply queue, go to `onUncorrelatedReply` and get acknowledged
  afterwards.
