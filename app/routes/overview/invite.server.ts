import { randomUUID } from "node:crypto";

import { data, redirect } from "react-router";

import {
  findInvitee,
  listGuests,
  recordInvitation,
  settleErvInvitation,
} from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import { invitationState } from "~/core/domain/invitation";
import { givenName } from "~/core/domain/participant";
import { formatInstant } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { appointmentIdOf } from "~/lib/auth/appointment-guard.server";
import { sendInvitationEmail } from "~/lib/email/send-invitation-email";
import { sendErvInvitation } from "~/lib/erv/send-erv-invitation";
import { isSafeId } from "~/lib/infra/erv-versand/erv-versand-messages";
import { ervInvitationPdfPath } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

import { GUESTS_ANCHOR, type GuestRow } from "./guests";
import { invitationLabel, parseInviteIntent } from "./invitation";

// The guests of the user's own Terminumfrage as the guest list shows them.
// An ERV invitation shows whether it went out as of `now`.
export async function loadGuestRows(
  userId: string,
  appointmentId: string,
  now: Date,
): Promise<GuestRow[]> {
  const guests = await listGuests(getDb(), userId, appointmentId);
  return guests.map(({ invitations, ...guest }) => ({
    ...guest,
    ervPdf: guest.safeId ? ervInvitationPdfPath(appointmentId, guest.id) : null,
    invitations: invitations.map(({ channel, at, status }) => {
      const state = invitationState({ status, at }, now);
      return { label: invitationLabel(channel, state), state, at: formatInstant(at) };
    }),
  }));
}

type InviteArgs = { request: Request; params: { appointmentId?: string } };

// The action of every page with the guest list: invites one guest of an open Terminumfrage by
// e-mail or ERV, or records that the judge invited them outside the app. An e-mail is recorded once
// it went out. An ERV invitation is recorded as pending and handed to the Basisdienst: ERV Versand,
// whose reply settles it later (see erv-replies.ts); if it cannot be handed over, it is recorded as
// failed. Afterwards the page shows again, at the guest list.
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
    // The SAFE-ID is not checked when it is entered. Nothing could deliver to a malformed one.
    if (!isSafeId(invitee.safeId)) return data({ notSent: invitee.name }, { status: 502 });

    // Recorded before it is handed over, so a fast reply finds it.
    const correlationId = randomUUID();
    const erv = { channel: "erv", correlationId } as const;
    if (!(await recordInvitation(db, user.id, id, invitee.id, erv))) throw notFound();
    const handedOver = await sendErvInvitation({
      appointmentId: id,
      participantId: invitee.id,
      safeId: invitee.safeId,
      name: givenName(invitee),
      aktenzeichen: invitee.aktenzeichen,
      slots: invitee.slots,
      token: invitee.token,
      correlationId,
      now: new Date(),
    });
    if (!handedOver) {
      await settleErvInvitation(db, correlationId, {
        status: "failed",
        failure: "not handed over",
      });
      return data({ notSent: invitee.name }, { status: 502 });
    }
    return redirect(`${back(id)}#${GUESTS_ANCHOR}`);
  }

  if (!(await recordInvitation(db, user.id, id, invitee.id, { channel: invite.channel }))) {
    throw notFound();
  }
  return redirect(`${back(id)}#${GUESTS_ANCHOR}`);
}
