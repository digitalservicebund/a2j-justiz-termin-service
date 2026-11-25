import type { InvitationStatus } from "~/core/domain/invitation";
import type { InvitationChannel } from "~/database/types";

const CHANNELS: readonly InvitationChannel[] = ["email", "erv", "manual"];

// The intent of an invite button: "invite-<channel>:<participant id>".
export const inviteIntent = (channel: InvitationChannel, participantId: string) =>
  `invite-${channel}:${participantId}`;

// Undefined for anything that is not an invite button.
export function parseInviteIntent(
  intent: FormDataEntryValue | null,
): { channel: InvitationChannel; participantId: string } | undefined {
  if (typeof intent !== "string") return undefined;
  const match = /^invite-([a-z]+):(.+)$/.exec(intent);
  const channel = CHANNELS.find((known) => known === match?.[1]);
  if (!channel || !match?.[2]) return undefined;
  return { channel, participantId: match[2] };
}

const SENT_LABEL: Record<InvitationChannel, string> = {
  email: "Per E-Mail eingeladen",
  erv: "Per ERV eingeladen",
  manual: "Manuell eingeladen",
};

// How an invitation went out, as the guest list shows it. Only an ERV invitation can be pending or
// fail after it was recorded.
export function invitationLabel(channel: InvitationChannel, state: InvitationStatus): string {
  if (state === "pending") return "Per ERV: wird gesendet";
  if (state === "failed") return "Per ERV: nicht zugestellt";
  return SENT_LABEL[channel];
}
