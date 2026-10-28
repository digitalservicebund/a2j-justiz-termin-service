import type { Attachment } from "nodemailer/lib/mailer/index.js";

import { requireEnv } from "../env.ts";
import { logError } from "../logging.ts";
import { requireSecret } from "../secrets.ts";
import { createSmtpTransport } from "../smtp.ts";

type Rendered = { subject: string; text: string; html: string; attachments: Attachment[] };

type Delivery = {
  to: string;
  appointmentId: string;
  // What went wrong, for the log.
  failure: string;
  render: (context: { terminUrl: string; from: string }) => Rendered;
};

// Mails the judge about an appointment, with a link to open it. A mail problem never undoes what
// triggered it, so failures are logged, not thrown.
export async function deliverEmail({
  to,
  appointmentId,
  failure,
  render,
}: Delivery): Promise<boolean> {
  let transport: ReturnType<typeof createSmtpTransport> | undefined;
  try {
    const terminUrl = `${requireEnv("BASE_URL")}/overview/${encodeURIComponent(appointmentId)}`;
    const from = requireSecret("smtp", "SMTP_USER");
    const { subject, text, html, attachments } = render({ terminUrl, from });
    transport = createSmtpTransport();
    await transport.sendMail({
      from,
      to: to.trim().toLowerCase(),
      subject,
      text,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    logError(failure, error);
    return false;
  } finally {
    transport?.close();
  }
}
