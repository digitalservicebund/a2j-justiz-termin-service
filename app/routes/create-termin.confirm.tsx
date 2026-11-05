import { data, redirect, useLoaderData } from "react-router";

import {
  getAppointment,
  nextCalendarSequence,
  publishAppointment,
} from "~/adapters/appointments/appointments.server";
import { listParticipants } from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { getDb } from "~/database/database";
import { sendTerminCreatedEmail } from "~/lib/email/send-termin-created-email";

import { draftHref } from "./create-termin.paths";
import { CreateTerminReview, createTerminBreadcrumbs } from "./create-termin.review";
import { validateCreateTermin } from "./create-termin.schema";
import { rangeToSlot } from "./create-termin.slots";

type Params = { params: { appointmentId?: string } };

const notFound = () => data("Not found", { status: 404 });

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const appointment = await getAppointment(getDb(), user.id, params.appointmentId ?? "");
  if (!appointment) throw notFound();
  // Only drafts are reviewed; a published appointment has nothing left to confirm.
  if (appointment.status !== "draft") throw redirect("/overview");

  // A draft can be saved half-finished, so it is only reviewed once it is complete.
  const values = {
    aktenzeichen: appointment.aktenzeichen,
    slots: appointment.slots.map(rangeToSlot),
  };
  if (!validateCreateTermin(values).success) throw redirect(draftHref(appointment.id));
  return { user, values, participants: await listParticipants(getDb(), user.id, appointment.id) };
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
    slots: appointment.slots,
    sequence,
  });
}

export async function action({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const intent = (await request.formData()).get("intent");

  if (intent === "back") {
    return redirect(draftHref(id));
  }
  if (intent === "create") {
    // The draft may have changed since it was reviewed, so it is checked again before publishing.
    const appointment = await getAppointment(getDb(), user.id, id);
    if (!appointment) throw notFound();
    const values = {
      aktenzeichen: appointment.aktenzeichen,
      slots: appointment.slots.map(rangeToSlot),
    };
    if (appointment.status === "draft" && !validateCreateTermin(values).success) {
      return redirect(draftHref(id));
    }
    if (!(await publishAppointment(getDb(), user.id, id))) throw notFound();
    await notifyJudge(user.id, user.email, id);
    return redirect(`/overview/${encodeURIComponent(id)}/created`);
  }
  throw data("Bad request", { status: 400 });
}

export default function CreateTerminConfirm() {
  const { user, values, participants } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <CreateTerminReview values={values} participants={participants} />
    </AppShell>
  );
}
