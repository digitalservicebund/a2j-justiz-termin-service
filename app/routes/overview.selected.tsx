import { data, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyButton } from "~/components/shared/CopyButton";
import { getDb } from "~/database/database";

import { NextSteps, Step, SuccessBanner } from "./create-termin.created";
import { selectBreadcrumbs } from "./overview.select.schema";
import { formatInstant } from "./overview.status";

import "./create-termin.created.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  // Until a Termin is confirmed there is nothing to announce; the detail page handles every state.
  if (appointment.status !== "confirmed" || !appointment.confirmedSlot) {
    throw redirect(`/overview/${encodeURIComponent(id)}`);
  }

  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    termin: formatInstant(appointment.confirmedSlot.start),
  };
}

export default function OverviewSelected() {
  const { user, aktenzeichen, termin } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={selectBreadcrumbs}>
      <div className="create-termin-created">
        <SuccessBanner title={`Der Termin ist am ${termin}.`} />

        <NextSteps>
          <Step title="Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den Termin.">
            <p className="kern-body">{termin}</p>
            <CopyButton
              text={`Aktenzeichen: ${aktenzeichen}\nTermin: ${termin}`}
              label="Termindetails kopieren"
              copiedLabel="Termindetails kopiert"
              announcement="Die Termindetails wurden kopiert."
              className="kern-btn--small"
            />
          </Step>
          <Step title="Ihre Servicestelle verschickt die Ladung." />
        </NextSteps>
      </div>
    </AppShell>
  );
}
