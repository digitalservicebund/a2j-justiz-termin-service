import { redirect, useLoaderData } from "react-router";

import {
  getAppointment,
  type Appointment,
  nextCalendarSequence,
  publishAppointment,
} from "~/adapters/appointments/appointments.server";
import { listParticipants } from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { courtName } from "~/core/domain/court/court";
import { getDb } from "~/database/database";
import {
  appointmentIdOf,
  getOwnAppointment,
  requireOwnAppointment,
} from "~/lib/auth/appointment-guard.server";
import { sendTerminCreatedEmail } from "~/lib/email/send-termin-created-email";
import { createdPath, draftPath, OVERVIEW_PATH } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

import { createTerminBreadcrumbs } from "./breadcrumbs";
import { CreateTerminReview } from "./review";
import { validateCreateTermin, type CreateTerminValues } from "./schema";
import { rangeToSlot } from "./slots";

type Params = { params: { appointmentId?: string } };

const draftValues = (appointment: Appointment): CreateTerminValues => ({
  aktenzeichen: appointment.aktenzeichen,
  minDurationMinutes: appointment.minDurationMinutes ?? null,
  courtCode: appointment.courtCode ?? null,
  slots: appointment.slots.map(rangeToSlot),
});

export async function loader({ request, params }: { request: Request } & Params) {
  // Only drafts are reviewed; a published appointment has nothing left to confirm.
  const { user, appointment } = await requireOwnAppointment(request, params, {
    status: "draft",
    otherwise: OVERVIEW_PATH,
  });

  // A draft can be saved half-finished, so it is only reviewed once it is complete.
  const values = draftValues(appointment);
  if (!validateCreateTermin(values).success) throw redirect(draftPath(appointment.id));
  return {
    user,
    values,
    court: courtName(values.courtCode) ?? null,
    participants: await listParticipants(getDb(), user.id, appointment.id),
  };
}

// Tells the judge that the Terminumfrage is open. The appointment is published either way.
async function notifyJudge(userId: string, email: string, id: string) {
  const appointment = await getAppointment(getDb(), userId, id);
  const sequence = await nextCalendarSequence(getDb(), id);
  if (!appointment || sequence === undefined) return;
  await sendTerminCreatedEmail({
    to: email,
    appointmentId: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    court: courtName(appointment.courtCode) ?? null,
    slots: appointment.slots,
    sequence,
  });
}

export async function action({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = appointmentIdOf(params);
  const intent = (await request.formData()).get("intent");

  if (intent === "back") {
    return redirect(draftPath(id));
  }
  if (intent === "create") {
    // The draft may have changed since it was reviewed, so it is checked again before publishing.
    const appointment = await getOwnAppointment(user.id, id);
    const values = draftValues(appointment);
    if (appointment.status === "draft" && !validateCreateTermin(values).success) {
      return redirect(draftPath(id));
    }
    if (!(await publishAppointment(getDb(), user.id, id))) throw notFound();
    await notifyJudge(user.id, user.email, id);
    return redirect(createdPath(id));
  }
  throw badRequest();
}

export default function CreateTerminConfirm() {
  const { user, values, court, participants } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <CreateTerminReview values={values} court={court} participants={participants} />
    </AppShell>
  );
}
