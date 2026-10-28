import { data, redirect, useLoaderData } from "react-router";

import {
  getAppointment,
  nextCalendarSequence,
  publishAppointment,
} from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { getDb } from "~/database/database";
import { sendTerminCreatedEmail } from "~/lib/email/send-termin-created-email";

import { CreateTerminReview, createTerminBreadcrumbs } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";

type Params = { params: { appointmentId?: string } };

const notFound = () => data("Not found", { status: 404 });

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const appointment = await getAppointment(getDb(), user.id, params.appointmentId ?? "");
  if (!appointment) throw notFound();
  // Only drafts are reviewed; a published appointment has nothing left to confirm.
  if (appointment.status !== "draft") throw redirect("/overview");

  return {
    user,
    values: { aktenzeichen: appointment.aktenzeichen, slots: appointment.slots.map(rangeToSlot) },
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
    slots: appointment.slots,
    sequence,
  });
}

export async function action({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const intent = (await request.formData()).get("intent");

  if (intent === "back") {
    return redirect(`/overview/new?entwurf=${encodeURIComponent(id)}`);
  }
  if (intent === "create") {
    if (!(await publishAppointment(getDb(), user.id, id))) throw notFound();
    await notifyJudge(user.id, user.email, id);
    return redirect(`/overview/${encodeURIComponent(id)}/created`);
  }
  throw data("Bad request", { status: 400 });
}

export default function CreateTerminConfirm() {
  const { user, values } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <CreateTerminReview values={values} />
    </AppShell>
  );
}
