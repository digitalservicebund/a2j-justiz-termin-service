import type { Kysely } from "kysely";
import { z } from "zod";

import type { FeedAppointment } from "../../core/domain/availability.ts";
import { confirmedWindow } from "../../core/domain/time/time-range.ts";
import type { Database } from "../../database/types.ts";
import { readAvailabilities } from "./availability.server.ts";

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
      "court_code",
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

  // All appointments in two queries, however many there are.
  const availabilities = await readAvailabilities(db, ids);

  return appointments.flatMap((appointment): FeedAppointment[] => {
    const appointmentSlots = availabilities.get(appointment.id)?.slots ?? [];

    if (appointment.status === "open") {
      return [
        {
          id: appointment.id,
          aktenzeichen: appointment.aktenzeichen,
          courtCode: appointment.court_code,
          calendarSequence: appointment.calendar_sequence,
          confirmed: null,
          slots: appointmentSlots,
        },
      ];
    }

    const slot = appointmentSlots.find(({ id }) => id === appointment.confirmed_slot_id);
    const window = confirmedWindow(appointment);
    if (!slot || !window) return [];
    return [
      {
        id: appointment.id,
        aktenzeichen: appointment.aktenzeichen,
        courtCode: appointment.court_code,
        calendarSequence: appointment.calendar_sequence,
        confirmed: { slotId: slot.id, ...window },
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
