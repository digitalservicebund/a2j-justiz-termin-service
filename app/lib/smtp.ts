import { createTransport } from "nodemailer";

import { requireEnv } from "./env.ts";
import { requireSecret } from "./secrets.ts";

const TIMEOUT_MS = 5000;

export function createSmtpTransport() {
  return createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number.parseInt(requireEnv("SMTP_PORT"), 10),
    secure: false, // STARTTLS on 587
    requireTLS: true,
    auth: {
      user: requireSecret("smtp", "SMTP_USER"),
      pass: requireSecret("smtp", "SMTP_PASSWORD"),
    },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}
