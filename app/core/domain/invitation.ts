// "pending": handed to the Basisdienst: ERV Versand, which has not replied yet
// "sent": went out; e-mail and manual invitations are sent when they are recorded
// "failed": the ERV did not deliver it
export type InvitationStatus = "pending" | "sent" | "failed";

// How an ERV invitation ended: sent, or not delivered and why.
export type ErvSettlement = { status: "sent" } | { status: "failed"; failure: string };

// How long the ERV may take to reply, as the default timeout of the Basisdienst's client. After
// that, a pending invitation counts as not delivered. A reply that still comes settles it anyway.
export const ERV_REPLY_TIMEOUT_MS = 5 * 60 * 1000;

// Whether an invitation went out, as the judge sees it at `now`.
export function invitationState(
  { status, at }: { status: InvitationStatus; at: Date },
  now: Date,
): InvitationStatus {
  if (status === "pending" && now.getTime() - at.getTime() > ERV_REPLY_TIMEOUT_MS) return "failed";
  return status;
}
