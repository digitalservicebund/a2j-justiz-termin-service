import { logInfo } from "../infra/logging.ts";

type ErvInvitation = { appointmentId: string; participantId: string; safeId: string };

// Sends a guest the survey link through the electronic legal transport (ERV) to their SAFE-ID.
// The app is not connected to the ERV yet, so this only logs that it would send one. Like the other
// logs, it names ids only: no SAFE-ID and no personal link. Returns whether the invitation went out.
export async function sendErvInvitation({
  appointmentId,
  participantId,
}: ErvInvitation): Promise<boolean> {
  logInfo(
    `ERV is not connected: would send participant ${participantId} of ${appointmentId} the survey link`,
  );
  return true;
}
