import { requireEnv } from "../env.ts";
import { logError } from "../logging.ts";
import { requireSecret } from "../secrets.ts";
import { createSmtpTransport } from "../smtp.ts";
import { renderTerminCreatedEmail, type TerminCreatedEmail } from "./termin-created-email.ts";

type Notification = Omit<TerminCreatedEmail, "terminUrl"> & { to: string };

// Tells the judge that the Terminumfrage is open and attaches the tentative time slots.
// A mail problem never undoes the published appointment, so failures are logged, not thrown.
export async function sendTerminCreatedEmail({ to, ...termin }: Notification): Promise<boolean> {
  let transport: ReturnType<typeof createSmtpTransport> | undefined;
  try {
    const terminUrl = `${requireEnv("BASE_URL")}/overview/${encodeURIComponent(termin.appointmentId)}`;
    const { subject, text, html, attachments } = renderTerminCreatedEmail({
      ...termin,
      terminUrl,
    });
    transport = createSmtpTransport();
    await transport.sendMail({
      from: requireSecret("smtp", "SMTP_USER"),
      to: to.trim().toLowerCase(),
      subject,
      text,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    logError("Failed to send Terminumfrage-created email", error);
    return false;
  } finally {
    transport?.close();
  }
}
