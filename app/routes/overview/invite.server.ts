import { data, redirect } from "react-router";

import {
  findInvitee,
  listGuests,
  recordInvitation,
} from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import { formatInstant } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { appointmentIdOf } from "~/lib/auth/appointment-guard.server";
import { sendInvitationEmail } from "~/lib/email/send-invitation-email";
import { sendErvInvitation } from "~/lib/erv/send-erv-invitation";
import { ervInvitationPdfPath } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

import { GUESTS_ANCHOR, type GuestRow } from "./guests";
import { invitedLabel, parseInviteIntent } from "./invitation";

// The guests of the user's own Terminumfrage as the guest list shows them.
export async function loadGuestRows(userId: string, appointmentId: string): Promise<GuestRow[]> {
  const guests = await listGuests(getDb(), userId, appointmentId);
  return guests.map(({ invitations, ...guest }) => ({
    ...guest,
    ervPdf: guest.safeId ? ervInvitationPdfPath(appointmentId, guest.id) : null,
    invitations: invitations.map(({ channel, at }) => ({
      label: invitedLabel[channel],
      at: formatInstant(at),
    })),
  }));
}

type InviteArgs = { request: Request; params: { appointmentId?: string } };

// The action of every page with the guest list: invites one guest of an open Terminumfrage by
// e-mail or ERV, or records that the judge invited them outside the app. Only a sent invitation is
// recorded. Afterwards the page shows again, at the guest list.
export async function inviteGuest({ request, params }: InviteArgs, back: (id: string) => string) {
  const user = await requireRole(request, "richter");
  const id = appointmentIdOf(params);
  const invite = parseInviteIntent((await request.formData()).get("intent"));
  if (!invite) throw badRequest();

  const db = getDb();
  const invitee = await findInvitee(db, user.id, id, invite.participantId);
  if (!invitee) throw notFound();

  if (invite.channel === "email") {
    if (!invitee.email) throw badRequest();
    const sent = await sendInvitationEmail({
      to: invitee.email,
      token: invitee.token,
      aktenzeichen: invitee.aktenzeichen,
      slots: invitee.slots,
    });
    if (!sent) return data({ notSent: invitee.name }, { status: 502 });
  } else if (invite.channel === "erv") {
    if (!invitee.safeId) throw badRequest();
    await sendErvInvitation({
      appointmentId: id,
      participantId: invitee.id,
      safeId: invitee.safeId,
    });
  }

  if (!(await recordInvitation(db, user.id, id, invitee.id, invite.channel))) throw notFound();
  return redirect(`${back(id)}#${GUESTS_ANCHOR}`);
}
