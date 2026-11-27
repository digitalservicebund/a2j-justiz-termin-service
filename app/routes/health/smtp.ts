import { log } from "~/lib/infra/logging";
import { createSmtpTransport } from "~/lib/infra/smtp";

// Connects and authenticates against the SMTP server without sending mail.
// Separate from /health, which backs the readiness probe.
export async function loader(): Promise<Response> {
  try {
    const transport = createSmtpTransport();
    try {
      await transport.verify();
    } finally {
      transport.close();
    }
    return Response.json({ status: "ok" });
  } catch (error) {
    log.error({ err: error }, "SMTP health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
