import { surveyUrl } from "../paths.ts";
import { deliverEmail } from "./deliver-email.ts";
import { renderInvitationEmail, type InvitationEmail } from "./invitation-email.ts";

type Invitation = Omit<InvitationEmail, "surveyUrl"> & { to: string; token: string };

// Mails a guest the personal link to the survey. Returns whether the mail went out.
export function sendInvitationEmail({ to, token, ...termin }: Invitation) {
  return deliverEmail({
    to,
    link: (baseUrl) => surveyUrl(baseUrl, token),
    failure: "Failed to send invitation email",
    render: ({ url }) => renderInvitationEmail({ ...termin, surveyUrl: url }),
  });
}
