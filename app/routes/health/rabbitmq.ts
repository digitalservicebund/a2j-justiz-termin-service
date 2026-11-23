import { logError } from "~/lib/logging";
import { connectRabbitMq } from "~/lib/rabbitmq";

// Connects and authenticates against the RabbitMQ broker, then closes the connection.
// Separate from /health, which backs the readiness probe.
export async function loader(): Promise<Response> {
  try {
    const connection = await connectRabbitMq();
    await connection.close();
    return Response.json({ status: "ok" });
  } catch (error) {
    logError("RabbitMQ health check failed", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
