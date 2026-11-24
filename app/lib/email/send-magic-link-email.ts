import { logError } from "../infra/logging.ts";
import { sendEmail } from "./deliver-email.ts";
import { renderMagicLinkEmail, type MagicLinkVariant } from "./magic-link-email.ts";

type MagicLink = { to: string; variant: MagicLinkVariant; url: string };

// Mails the sign-in link that Better Auth created. Unlike the other mails, a failure is thrown:
// Better Auth then tells the person that no link went out.
export async function sendMagicLinkEmail({ to, variant, url }: MagicLink): Promise<void> {
  try {
    await sendEmail({ to, render: () => renderMagicLinkEmail(variant, url) });
  } catch (error) {
    logError("Failed to send magic-link email", error);
    throw error;
  }
}
