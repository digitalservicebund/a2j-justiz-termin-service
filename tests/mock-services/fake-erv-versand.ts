// A stand-in for the Basisdienst: ERV Versand on the local RabbitMQ, for development and E2E tests.
// docker-compose.yml runs it as the service `erv-versand`. It sends nothing anywhere: it sets up the
// exchange and queues the real Basisdienst provides, answers every request the way it would (see
// answer() in fake-erv-versand-core.ts) and keeps the requests for its HTTP API on HTTP_PORT.
import { createServer } from "node:http";

import { logError, logInfo } from "../../app/lib/infra/logging.ts";
import { connectRabbitMq } from "../../app/lib/infra/rabbitmq.ts";
import {
  answer,
  MessageStore,
  parsePayload,
  receivedMessage,
  route,
} from "./fake-erv-versand-core.ts";

const REQUEST_EXCHANGE = "requests";
const REQUEST_QUEUE = "erv-versand.requests";
const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT ?? "8080", 10);

const store = new MessageStore();
let ready = false;

createServer((request, response) => {
  const { status, headers, body } = route(
    store,
    ready,
    request.method ?? "GET",
    new URL(request.url ?? "/", "http://localhost"),
  );
  response.writeHead(status, headers).end(body);
}).listen(HTTP_PORT, () => logInfo(`Fake ERV Versand: HTTP API on port ${HTTP_PORT}`));

try {
  const connection = await connectRabbitMq();
  const channel = await connection.createChannel();
  await channel.assertExchange(REQUEST_EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(REQUEST_QUEUE, { durable: true });
  await channel.bindQueue(REQUEST_QUEUE, REQUEST_EXCHANGE, REQUEST_EXCHANGE);
  // The app's reply queue. The real Basisdienst provisions one per client.
  await channel.assertQueue(`replies.${process.env.RABBITMQ_USER}`, { durable: true });

  await channel.consume(REQUEST_QUEUE, (message) => {
    if (message === null) {
      logError("Fake ERV Versand: request consumer was cancelled");
      process.exit(1);
    }
    const { correlationId, userId, type } = message.properties;
    const payload = parsePayload(message.content);
    const reply = answer(type, payload);
    store.add(receivedMessage({ correlationId, userId, type }, payload, reply, new Date()));
    // Like the real Basisdienst, a request without a user ID cannot be answered and is dropped.
    if (reply && userId) {
      channel.sendToQueue(`replies.${userId}`, Buffer.from(JSON.stringify(reply.payload)), {
        correlationId,
        type: reply.type,
        contentType: reply.contentType,
        persistent: true,
      });
    }
    logInfo(`Fake ERV Versand: ${type} (correlation ID ${correlationId}) -> ${reply?.type}`);
    channel.ack(message);
  });

  ready = true;
  logInfo("Fake ERV Versand: waiting for requests");
} catch (error) {
  logError("Fake ERV Versand could not start", error);
  process.exit(1);
}
