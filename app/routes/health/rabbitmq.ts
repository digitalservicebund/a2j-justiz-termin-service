import { replyQueueName } from "~/lib/infra/erv-versand/erv-versand-client";
import { log } from "~/lib/infra/logging";
import { connectRabbitMq } from "~/lib/infra/rabbitmq";
import { requireSecret } from "~/lib/infra/secrets";

type Connection = Awaited<ReturnType<typeof connectRabbitMq>>;

// RabbitMQ answers a check of a queue that does not exist with this AMQP reply code.
const NOT_FOUND = 404;

// Logs whether the queue the Basisdienst: ERV Versand replies to exists. The Basisdienst provides
// it, and without it no ERV invitation gets an answer. Only logged: the broker itself works.
async function logReplyQueue(connection: Connection): Promise<void> {
  const queue = replyQueueName(requireSecret("rabbitmq", "RABBITMQ_USER"));
  try {
    // A failed check closes the channel, so it gets one of its own. The broker's error also comes
    // as an event; unheard, it would bring down the connection and the process.
    const channel = await connection.createChannel();
    channel.on("error", () => {
      // Handled where checkQueue rejects.
    });
    const { messageCount, consumerCount } = await channel.checkQueue(queue);
    log.info({ queue, messageCount, consumerCount }, "ERV reply queue exists");
    await channel.close();
  } catch (error) {
    if ((error as { code?: unknown }).code === NOT_FOUND) {
      log.error({ queue }, "ERV reply queue does not exist");
    } else {
      log.error({ err: error, queue }, "could not check the ERV reply queue");
    }
  }
}

// Connects and authenticates against the RabbitMQ broker, logs whether the ERV reply queue exists,
// then closes the connection. Separate from /health, which backs the readiness probe.
export async function loader(): Promise<Response> {
  try {
    const connection = await connectRabbitMq();
    try {
      await logReplyQueue(connection);
    } finally {
      await connection.close();
    }
    return Response.json({ status: "ok" });
  } catch (error) {
    log.error({ err: error }, "RabbitMQ health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
