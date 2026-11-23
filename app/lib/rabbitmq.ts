import { connect } from "amqplib";

import { requireEnv } from "./env.ts";
import { requireSecret } from "./secrets.ts";

const TIMEOUT_MS = 5000;

// Opens a connection to the RabbitMQ broker. The caller closes it.
export function connectRabbitMq() {
  return connect(
    {
      // Only the local broker lacks TLS, deployed environments leave this unset.
      protocol: process.env.RABBITMQ_TLS === "false" ? "amqp" : "amqps",
      hostname: requireEnv("RABBITMQ_HOST"),
      port: Number.parseInt(requireEnv("RABBITMQ_PORT"), 10),
      vhost: requireEnv("RABBITMQ_VHOST"),
      username: requireSecret("rabbitmq", "RABBITMQ_USER"),
      password: requireSecret("rabbitmq", "RABBITMQ_PASSWORD"),
    },
    { timeout: TIMEOUT_MS },
  );
}
