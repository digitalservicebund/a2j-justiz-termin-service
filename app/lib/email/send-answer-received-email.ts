import type { ResponseOverview } from "../../adapters/appointments/survey.server.ts";
import { renderAnswerReceivedEmail } from "./answer-received-email.ts";
import { deliverEmail } from "./deliver-email.ts";

// Tells the judge who answered the Terminumfrage and where it stands now.
export function sendAnswerReceivedEmail(
  overview: ResponseOverview,
  responder: { id: string; name: string },
) {
  return deliverEmail({
    to: overview.judgeEmail,
    appointmentId: overview.appointmentId,
    failure: "Failed to send answer-received email",
    render: ({ terminUrl, from }) =>
      renderAnswerReceivedEmail({ overview, responder, terminUrl, organizerEmail: from }),
  });
}
