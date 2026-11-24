import type { ResponseOverview } from "../../core/domain/availability.ts";
import { appointmentUrl } from "../web/paths.ts";
import { renderAnswerReceivedEmail } from "./answer-received-email.ts";
import { deliverEmail } from "./deliver-email.ts";

// Tells the judge who answered the Terminumfrage and where it stands now.
export function sendAnswerReceivedEmail(
  overview: ResponseOverview,
  responder: { id: string; name: string },
) {
  return deliverEmail({
    to: overview.judgeEmail,
    link: (baseUrl) => appointmentUrl(baseUrl, overview.appointmentId),
    failure: "Failed to send answer-received email",
    render: ({ url, from }) =>
      renderAnswerReceivedEmail({ overview, responder, terminUrl: url, organizerEmail: from }),
  });
}
