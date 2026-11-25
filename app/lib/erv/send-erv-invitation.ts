import { randomUUID } from "node:crypto";

import type { Slot } from "../../core/domain/availability.ts";
import { requireEnv } from "../infra/env.ts";
import { ervVersandClient } from "../infra/erv-versand/erv-versand-connection.ts";
import { isSafeId } from "../infra/erv-versand/erv-versand-messages.ts";
import { logError, logInfo } from "../infra/logging.ts";
import { surveyUrl } from "../web/paths.ts";
import { ERV_INVITATION_FILE_NAME, ervInvitationMessage } from "./erv-invitation-message.ts";
import { renderErvInvitationPdf } from "./erv-invitation-pdf.ts";

type ErvInvitation = {
  appointmentId: string;
  participantId: string;
  safeId: string;
  // The guest's name, if the judge gave one.
  name: string | null;
  aktenzeichen: string;
  slots: Slot[];
  // The guest's personal survey token.
  token: string;
  // Ties the reply of the Basisdienst to the recorded invitation.
  correlationId: string;
  now: Date;
};

const base64 = (content: string | Buffer) => Buffer.from(content).toString("base64");

// Hands a guest's invitation to the Basisdienst: ERV Versand, which sends it through the
// electronic legal transport (ERV) to their SAFE-ID: an XJustiz message with the invitation PDF,
// which holds the personal survey link. Returns once the broker took it over, without waiting for
// the ERV: its reply comes later with the same correlation ID (see erv-replies.ts). Returns false
// when the invitation could not be handed over, and logs why. Logs name ids only, never the
// SAFE-ID or the link.
export async function sendErvInvitation({
  appointmentId,
  participantId,
  safeId,
  name,
  aktenzeichen,
  slots,
  token,
  correlationId,
  now,
}: ErvInvitation): Promise<boolean> {
  const failure = `ERV invitation to participant ${participantId} of ${appointmentId} not sent`;
  // The SAFE-ID is not checked when it is entered. The Basisdienst would reject it anyway.
  if (!isSafeId(safeId)) {
    logError(`${failure}: not a SAFE-ID`);
    return false;
  }

  try {
    const xml = ervInvitationMessage({
      aktenzeichen,
      recipient: name ?? safeId,
      messageId: randomUUID(),
      documentId: randomUUID(),
      // Set in the image by CI, see Dockerfile.
      version: process.env.COMMIT_SHA || "local",
      now,
    });
    const pdf = await renderErvInvitationPdf({
      aktenzeichen,
      name,
      slots,
      surveyUrl: surveyUrl(requireEnv("BASE_URL"), token),
    });

    const client = await ervVersandClient();
    await client.sendEgvpMessage(
      {
        receiver: safeId,
        xjustizMessage: { content: base64(xml) },
        attachments: [{ name: ERV_INVITATION_FILE_NAME, content: base64(pdf) }],
      },
      correlationId,
    );
    logInfo(
      `ERV invitation to participant ${participantId} of ${appointmentId} handed over (correlation ID ${correlationId})`,
    );
    return true;
  } catch (error) {
    logError(failure, error);
    return false;
  }
}
