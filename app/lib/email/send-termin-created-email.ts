import { deliverEmail } from "./deliver-email.ts";
import { renderTerminCreatedEmail, type TerminCreatedEmail } from "./termin-created-email.ts";

type Notification = Omit<TerminCreatedEmail, "terminUrl" | "organizerEmail"> & {
  to: string;
  appointmentId: string;
};

// Tells the judge that the Terminumfrage is open and attaches the tentative time slots.
export function sendTerminCreatedEmail({ to, appointmentId, ...termin }: Notification) {
  return deliverEmail({
    to,
    appointmentId,
    failure: "Failed to send Terminumfrage-created email",
    render: ({ terminUrl, from }) =>
      renderTerminCreatedEmail({ ...termin, terminUrl, organizerEmail: from }),
  });
}
