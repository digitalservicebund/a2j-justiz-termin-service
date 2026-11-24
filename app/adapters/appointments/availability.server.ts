import type { Kysely } from "kysely";

import {
  toAnsweredSlot,
  type Availability,
  type SlotResponse,
} from "../../core/domain/availability.ts";
import { rowToRange } from "../../core/domain/time/time-range.ts";
import type { Database } from "../../database/types.ts";
import { participantName } from "./participants.server.ts";

const NOTHING: Availability = { minDurationMinutes: null, slots: [] };

// The slots of the appointments with all answers, by appointment id. This is the one place that
// works out what is left of a slot, so every page, mail and calendar agrees. An appointment without
// slots has no entry. `exceptParticipantId` leaves out the answers of one participant.
export async function readAvailabilities(
  db: Kysely<Database>,
  appointmentIds: string[],
  exceptParticipantId?: string,
): Promise<Map<string, Availability>> {
  const result = new Map<string, Availability>();
  if (appointmentIds.length === 0) return result;

  const slots = await db
    .selectFrom("time_slot")
    .innerJoin("appointment", "appointment.id", "time_slot.appointment_id")
    .select([
      "time_slot.id",
      "time_slot.appointment_id",
      "time_slot.start_time",
      "time_slot.end_time",
      "appointment.min_duration_minutes",
    ])
    .where("time_slot.appointment_id", "in", appointmentIds)
    .orderBy("time_slot.start_time")
    .orderBy("time_slot.id")
    .execute();

  // One row per window, and one row without times for a response that has none.
  const rows = await db
    .selectFrom("participant_response")
    .innerJoin("participant", "participant.id", "participant_response.participant_id")
    .leftJoin(
      "participant_response_window",
      "participant_response_window.response_id",
      "participant_response.id",
    )
    .select([
      "participant_response.id as responseId",
      "participant_response.slot_id",
      "participant.id as participantId",
      participantName,
      "participant_response_window.start_time",
      "participant_response_window.end_time",
    ])
    .where("participant.appointment_id", "in", appointmentIds)
    .$if(exceptParticipantId !== undefined, (qb) =>
      qb.where("participant.id", "!=", exceptParticipantId!),
    )
    .orderBy("participant.created_at")
    .orderBy("participant.id")
    .orderBy("participant_response_window.start_time")
    .execute();

  const responsesBySlot = new Map<string, Map<string, SlotResponse>>();
  for (const row of rows) {
    const responses = responsesBySlot.get(row.slot_id) ?? new Map<string, SlotResponse>();
    responsesBySlot.set(row.slot_id, responses);
    const response = responses.get(row.responseId) ?? {
      participantId: row.participantId,
      name: row.name,
      available: false,
      windows: [],
    };
    responses.set(row.responseId, response);
    if (row.start_time !== null && row.end_time !== null) {
      response.windows.push(rowToRange({ start_time: row.start_time, end_time: row.end_time }));
      response.available = true;
    }
  }

  for (const row of slots) {
    const slot = { id: row.id, ...rowToRange(row) };
    const responses = [...(responsesBySlot.get(row.id)?.values() ?? [])];
    const availability = result.get(row.appointment_id) ?? {
      minDurationMinutes: row.min_duration_minutes,
      slots: [],
    };
    result.set(row.appointment_id, availability);
    availability.slots.push(toAnsweredSlot(slot, responses, row.min_duration_minutes));
  }
  return result;
}

export async function readAvailability(
  db: Kysely<Database>,
  appointmentId: string,
  exceptParticipantId?: string,
): Promise<Availability> {
  const all = await readAvailabilities(db, [appointmentId], exceptParticipantId);
  return all.get(appointmentId) ?? NOTHING;
}
