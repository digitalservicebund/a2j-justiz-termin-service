import type { LoaderFunctionArgs } from "react-router";

import { findInvitee } from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import { givenName } from "~/core/domain/participant";
import { getDb } from "~/database/database";
import { appointmentIdOf } from "~/lib/auth/appointment-guard.server";
import { renderErvInvitationPdf } from "~/lib/erv/erv-invitation-pdf";
import { requireEnv } from "~/lib/infra/env";
import { logInfo } from "~/lib/infra/logging";
import { surveyUrl } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

// "574 C 7/26" and "Person Ä" become "574-C-7-26" and "Person-Ae": a file name every system accepts.
const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};
const fileNamePart = (value: string) =>
  value
    .replaceAll(/[äöüÄÖÜß]/g, (umlaut) => UMLAUTS[umlaut] ?? "")
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

export const ervPdfFileName = (aktenzeichen: string, name: string | null) =>
  `${["Einladung-Terminumfrage", aktenzeichen, name ?? ""].map(fileNamePart).filter(Boolean).join("-")}.pdf`;

// The invitation of one guest of the judge's own open Terminumfrage as a PDF, to send through the
// ERV. It contains the guest's personal survey link, so it is never cached. Downloading it does not
// record an invitation: the judge does that once the PDF went out.
export async function loader({
  request,
  params,
}: Pick<LoaderFunctionArgs, "request" | "params">): Promise<Response> {
  const user = await requireRole(request, "richter");
  const id = appointmentIdOf(params);
  const invitee = await findInvitee(getDb(), user.id, id, params.participantId ?? "");
  if (!invitee) throw notFound();
  if (!invitee.safeId) throw badRequest();

  const name = givenName(invitee);
  const pdf = await renderErvInvitationPdf({
    aktenzeichen: invitee.aktenzeichen,
    name,
    slots: invitee.slots,
    surveyUrl: surveyUrl(requireEnv("BASE_URL"), invitee.token),
  });
  // Ids only: no SAFE-ID and no personal link.
  logInfo(`ERV PDF generated for participant ${invitee.id} of ${id}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ervPdfFileName(invitee.aktenzeichen, name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
