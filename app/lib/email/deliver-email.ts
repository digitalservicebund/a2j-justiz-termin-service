import type { Attachment } from "nodemailer/lib/mailer/index.js";

import { requireEnv } from "../env.ts";
import { logError } from "../logging.ts";
import { requireSecret } from "../secrets.ts";
import { createSmtpTransport } from "../smtp.ts";

type Rendered = { subject: string; text: string; html: string; attachments: Attachment[] };

type Delivery = {
  to: string;
  // The full URL of the page the mail links to, built from BASE_URL.
  link: (baseUrl: string) => string;
  // What went wrong, for the log.
  failure: string;
  render: (context: { url: string; from: string }) => Rendered;
};

// Mails someone about an appointment, with a link into the app. A mail problem never undoes what
// triggered it, so failures are logged, not thrown.
export async function deliverEmail({ to, link, failure, render }: Delivery): Promise<boolean> {
  let transport: ReturnType<typeof createSmtpTransport> | undefined;
  try {
    const url = link(requireEnv("BASE_URL"));
    const from = requireSecret("smtp", "SMTP_USER");
    const { subject, text, html, attachments } = render({ url, from });
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
