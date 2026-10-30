import type { Kysely } from "kysely";
import { z } from "zod";

import type { Database } from "../../database/types.ts";
import type { AppointmentSlot, TimeRange } from "./appointments.server.ts";
import type { SlotResponse } from "./survey.server.ts";

export type FeedAppointment = {
  id: string;
  aktenzeichen: string;
  calendarSequence: number;
  // The chosen window of a confirmed appointment, which lies within the slot `confirmedSlotId`.
  confirmed: (TimeRange & { slotId: string }) | null;
  slots: Array<AppointmentSlot & { responses: SlotResponse[] }>;
};

// The appointments that belong in the calendar feed of the user who owns the token: open ones with
// all their slots and confirmed ones with the chosen window. Drafts and cancelled appointments
// have nothing to show. Undefined for an unknown token.
export async function readCalendarFeed(
  db: Kysely<Database>,
  token: string,
): Promise<FeedAppointment[] | undefined> {
  // Anything but a UUID cannot match, and Postgres rejects it instead of finding nothing.
  if (!z.uuid().safeParse(token).success) return undefined;
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("calendar_token", "=", token)
    .executeTakeFirst();
  if (!user) return undefined;

  const appointments = await db
    .selectFrom("appointment")
    .select([
      "id",
      "aktenzeichen",
      "status",
      "calendar_sequence",
      "confirmed_slot_id",
      "confirmed_start_time",
      "confirmed_end_time",
    ])
    .where("user_id", "=", user.id)
    .where("status", "in", ["open", "confirmed"])
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  if (appointments.length === 0) return [];
  const ids = appointments.map(({ id }) => id);

  const slots = await db
    .selectFrom("time_slot")
    .select(["id", "appointment_id", "start_time", "end_time"])
    .where("appointment_id", "in", ids)
    .orderBy("start_time")
    .execute();

  const responses = await db
    .selectFrom("participant_response")
    .innerJoin("participant", "participant.id", "participant_response.participant_id")
    .select([
      "participant_response.slot_id",
      "participant_response.status",
      "participant.id as participantId",
      "participant.name",
    ])
    .where("participant.appointment_id", "in", ids)
    .orderBy("participant.created_at")
    .orderBy("participant.id")
    .execute();

  return appointments.flatMap((appointment): FeedAppointment[] => {
    const appointmentSlots = slots
      .filter(({ appointment_id }) => appointment_id === appointment.id)
      .map(({ id, start_time, end_time }) => ({
        id,
        start: new Date(start_time),
        end: new Date(end_time ?? start_time),
        responses: responses
          .filter(({ slot_id }) => slot_id === id)
          .map(({ participantId, name, status }) => ({
            participantId,
            name,
            available: status === "yes",
          })),
      }));

    if (appointment.status === "open") {
      return [
        {
          id: appointment.id,
          aktenzeichen: appointment.aktenzeichen,
          calendarSequence: appointment.calendar_sequence,
          confirmed: null,
          slots: appointmentSlots,
        },
      ];
    }

    // A window chosen within a slot wins over the whole slot, which older rows still rely on.
    const slot = appointmentSlots.find(({ id }) => id === appointment.confirmed_slot_id);
    if (!slot) return [];
    const { confirmed_start_time: start, confirmed_end_time: end } = appointment;
    return [
      {
        id: appointment.id,
        aktenzeichen: appointment.aktenzeichen,
        calendarSequence: appointment.calendar_sequence,
        confirmed: {
          slotId: slot.id,
          start: start && end ? new Date(start) : slot.start,
          end: start && end ? new Date(end) : slot.end,
        },
        slots: [slot],
      },
    ];
  });
}

// The secret of the user's calendar feed. Undefined for an unknown user.
export async function readCalendarToken(
  db: Kysely<Database>,
  userId: string,
): Promise<string | undefined> {
  const user = await db
    .selectFrom("user")
    .select("calendar_token")
    .where("id", "=", userId)
    .executeTakeFirst();
  return user?.calendar_token;
}
