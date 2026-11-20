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

// How the latest invitation went out, as the guest list shows it.
export const invitedLabel: Record<InvitationChannel, string> = {
  email: "Per E-Mail eingeladen",
  erv: "Per ERV eingeladen",
  manual: "Manuell eingeladen",
};
