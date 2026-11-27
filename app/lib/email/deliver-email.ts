import type { Attachment } from "nodemailer/lib/mailer/index.js";

import { requireEnv } from "../infra/env.ts";
import { log } from "../infra/logging.ts";
import { requireSecret } from "../infra/secrets.ts";
import { createSmtpTransport } from "../infra/smtp.ts";

type Rendered = { subject: string; text: string; html: string; attachments: Attachment[] };

type Message = {
  to: string;
  render: (context: { from: string }) => Rendered;
};

type Delivery = {
  to: string;
  // The full URL of the page the mail links to, built from BASE_URL.
  link: (baseUrl: string) => string;
  // What went wrong, for the log.
  failure: string;
  render: (context: { url: string; from: string }) => Rendered;
};

// Sends one mail from the SMTP account. Throws when it does not go out.
export async function sendEmail({ to, render }: Message): Promise<void> {
  const from = requireSecret("smtp", "SMTP_USER");
  const { subject, text, html, attachments } = render({ from });
  const transport = createSmtpTransport();
  try {
    await transport.sendMail({
      from,
      to: to.trim().toLowerCase(),
      subject,
      text,
      html,
      attachments,
    });
  } finally {
    transport.close();
  }
}

// Mails someone about an appointment, with a link into the app. A mail problem never undoes what
// triggered it, so failures are logged, not thrown.
export async function deliverEmail({ to, link, failure, render }: Delivery): Promise<boolean> {
  try {
    const url = link(requireEnv("BASE_URL"));
    await sendEmail({ to, render: ({ from }) => render({ url, from }) });
    return true;
  } catch (error) {
    log.error({ err: error }, failure);
    return false;
  }
}
