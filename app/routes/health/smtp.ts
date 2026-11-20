import { logError } from "~/lib/logging";
import { createSmtpTransport } from "~/lib/smtp";

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
    logError("SMTP health check failed", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
