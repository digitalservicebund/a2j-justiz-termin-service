import { data, redirect, useLoaderData } from "react-router";

import { getAppointment, publishAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { getDb } from "~/database/database";

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

export async function action({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const intent = (await request.formData()).get("intent");

  if (intent === "back") {
    return redirect(`/overview/new?entwurf=${encodeURIComponent(id)}`);
  }
  if (intent === "create") {
    if (!(await publishAppointment(getDb(), user.id, id))) throw notFound();
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
