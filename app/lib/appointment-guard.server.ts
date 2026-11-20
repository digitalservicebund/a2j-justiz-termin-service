import { redirect } from "react-router";

import { getAppointment, type Appointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";
import { getDb } from "~/database/database";
import type { AppointmentStatus } from "~/database/types";

import { notFound } from "./responses";

type AppointmentParams = { appointmentId?: string };

// Which states a page is for, and where a Terminumfrage in any other state goes instead.
type StatusGuard = {
  status: AppointmentStatus | readonly AppointmentStatus[];
  otherwise: string | ((id: string) => string);
};

// Every state but a draft: the Terminumfrage has been published.
export const PUBLISHED: readonly AppointmentStatus[] = ["open", "confirmed", "cancelled"];

// The id of the Terminumfrage a page is about. A missing id matches no appointment.
export const appointmentIdOf = (params: AppointmentParams) => params.appointmentId ?? "";

// The user's own Terminumfrage. Unknown ones and those of other users are not found alike, so the
// response does not tell whether an id exists.
export async function getOwnAppointment(
  userId: string,
  id: string,
  guard?: StatusGuard,
): Promise<Appointment> {
  const appointment = await getAppointment(getDb(), userId, id);
  if (!appointment) throw notFound();
  if (guard && ![guard.status].flat().includes(appointment.status)) {
    throw redirect(typeof guard.otherwise === "string" ? guard.otherwise : guard.otherwise(id));
  }
  return appointment;
}

// For the pages of a Terminumfrage: only judges see them, and only their own.
export async function requireOwnAppointment(
  request: Request,
  params: AppointmentParams,
  guard?: StatusGuard,
): Promise<{ user: AuthUser; id: string; appointment: Appointment }> {
  const user = await requireRole(request, "richter");
  const id = appointmentIdOf(params);
  const appointment = await getOwnAppointment(user.id, id, guard);
  return { user, id, appointment };
}
