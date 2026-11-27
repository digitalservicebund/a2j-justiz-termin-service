import type { Kysely } from "kysely";

import type { Slot } from "../../core/domain/availability.ts";
import type { ErvSettlement, InvitationStatus } from "../../core/domain/invitation.ts";
import { rowToRange } from "../../core/domain/time/time-range.ts";
import type { Database, InvitationChannel } from "../../database/types.ts";
import { logAudit } from "../../lib/infra/logging.ts";
import { participantName } from "./participants.server.ts";

// An invitation a guest got: how, when, and whether it went out.
export type Invitation = { channel: InvitationChannel; at: Date; status: InvitationStatus };

// A person the judge listed for the Terminumfrage. Only they have a personal link to invite them
// with; guests who answered through the universal link came by themselves.
export type Guest = {
  id: string;
  email: string | null;
  safeId: string | null;
  name: string | null;
  // Every invitation, newest first. Empty for a guest who was not invited yet.
  invitations: Invitation[];
};

// Everything an invitation needs about the guest and the Terminumfrage.
export type Invitee = {
  id: string;
  name: string;
  email: string | null;
  safeId: string | null;
  token: string;
  aktenzeichen: string;
  slots: Slot[];
};

// The people of the user's own appointment that the judge listed, in the order they were added,
// with their invitations. Empty for an appointment that is not the user's.
export async function listGuests(
  db: Kysely<Database>,
  userId: string,
  appointmentId: string,
): Promise<Guest[]> {
  const guests = await db
    .selectFrom("participant")
    .innerJoin("appointment", "appointment.id", "participant.appointment_id")
    .select([
      "participant.id",
      "participant.email",
      "participant.safe_id as safeId",
      "participant.name",
    ])
    .where("appointment.id", "=", appointmentId)
    .where("appointment.user_id", "=", userId)
    .where("participant.type", "=", "individual")
    .where("participant.token", "is not", null)
    .orderBy("participant.created_at")
    .orderBy("participant.id")
    .execute();
  if (guests.length === 0) return [];

  const invitations = await db
    .selectFrom("participant_invitation")
    .select(["participant_id", "channel", "created_at", "status"])
    .where(
      "participant_id",
      "in",
      guests.map(({ id }) => id),
    )
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .execute();

  return guests.map((guest) => ({
    ...guest,
    invitations: invitations
      .filter(({ participant_id }) => participant_id === guest.id)
      .map(({ channel, created_at, status }) => ({ channel, at: created_at, status })),
  }));
}

// A guest of the user's own open appointment, who can be invited. Returns undefined otherwise.
export async function findInvitee(
  db: Kysely<Database>,
  userId: string,
  appointmentId: string,
  participantId: string,
): Promise<Invitee | undefined> {
  const row = await db
    .selectFrom("participant")
    .innerJoin("appointment", "appointment.id", "participant.appointment_id")
    .select([
      "participant.id",
      participantName,
      "participant.email",
      "participant.safe_id as safeId",
      "participant.token",
      "appointment.aktenzeichen",
    ])
    .where("participant.id", "=", participantId)
    .where("appointment.id", "=", appointmentId)
    .where("appointment.user_id", "=", userId)
    .where("appointment.status", "=", "open")
    .where("participant.type", "=", "individual")
    .executeTakeFirst();
  if (!row?.token) return undefined;

  const slots = await db
    .selectFrom("time_slot")
    .select(["id", "start_time", "end_time"])
    .where("appointment_id", "=", appointmentId)
    .orderBy("start_time")
    .execute();

  return {
    ...row,
    token: row.token,
    slots: slots.map((slot) => ({ id: slot.id, ...rowToRange(slot) })),
  };
}

// Records that a guest of the user's own open appointment was invited. An ERV invitation is
// pending until the reply with its correlation ID settles it (see settleErvInvitation); the other
// channels are sent at once. Returns false when there is no such guest.
export async function recordInvitation(
  db: Kysely<Database>,
  userId: string,
  appointmentId: string,
  participantId: string,
  invitation: { channel: "email" | "manual" } | { channel: "erv"; correlationId: string },
): Promise<boolean> {
  const { channel } = invitation;
  const correlationId = invitation.channel === "erv" ? invitation.correlationId : null;
  const status: InvitationStatus = invitation.channel === "erv" ? "pending" : "sent";
  const recorded = await db
    .insertInto("participant_invitation")
    .columns(["participant_id", "channel", "status", "correlation_id"])
    .expression((eb) =>
      eb
        .selectFrom("participant")
        .innerJoin("appointment", "appointment.id", "participant.appointment_id")
        .select([
          "participant.id",
          eb.val(channel).as("channel"),
          eb.val(status).as("status"),
          eb.val(correlationId).as("correlation_id"),
        ])
        .where("participant.id", "=", participantId)
        .where("appointment.id", "=", appointmentId)
        .where("appointment.user_id", "=", userId)
        .where("appointment.status", "=", "open")
        .where("participant.type", "=", "individual"),
    )
    .returning("id")
    .executeTakeFirst();
  if (recorded) {
    logAudit("participant.invited", { actorId: userId, appointmentId, participantId, channel });
  }
  return Boolean(recorded);
}

// Settles the pending ERV invitation with this correlation ID with the reply of the Basisdienst.
// Returns false when there is none, for example because it was settled before.
export async function settleErvInvitation(
  db: Kysely<Database>,
  correlationId: string,
  settlement: ErvSettlement,
): Promise<boolean> {
  const settled = await db
    .updateTable("participant_invitation")
    .set({
      status: settlement.status,
      failure: settlement.status === "failed" ? settlement.failure : null,
    })
    .where("correlation_id", "=", correlationId)
    .where("channel", "=", "erv")
    .where("status", "=", "pending")
    .returning("id")
    .executeTakeFirst();
  return Boolean(settled);
}
