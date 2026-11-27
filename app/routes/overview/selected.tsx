import { redirect, useLoaderData } from "react-router";

import { AppShell } from "~/components/shared/AppShell";
import { CopyButton } from "~/components/shared/CopyButton";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernStack } from "~/components/shared/kern/KernStack";
import { NextSteps, Step, SuccessBanner } from "~/components/shared/NextSteps";
import { courtName } from "~/core/domain/court/court";
import { formatInstant } from "~/core/domain/time/format";
import { requireOwnAppointment } from "~/lib/auth/appointment-guard.server";
import { appointmentPath } from "~/lib/web/paths";

import { selectBreadcrumbs } from "./select.schema";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  // Until a Termin is confirmed there is nothing to announce; the detail page handles every state.
  const { user, id, appointment } = await requireOwnAppointment(request, params, {
    status: "confirmed",
    otherwise: appointmentPath,
  });
  if (!appointment.confirmedSlot) throw redirect(appointmentPath(id));

  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    court: courtName(appointment.courtCode) ?? null,
    termin: formatInstant(appointment.confirmedSlot.start),
  };
}

export default function OverviewSelected() {
  const { user, aktenzeichen, court, termin } = useLoaderData<typeof loader>();
  const details = [
    `Aktenzeichen: ${aktenzeichen}`,
    ...(court ? [`Gericht: ${court}`] : []),
    `Termin: ${termin}`,
  ].join("\n");
  return (
    <AppShell user={user} breadcrumbs={selectBreadcrumbs}>
      <KernStack className="next-steps__page">
        <SuccessBanner title={`Der Termin ist am ${termin}.`} />

        <NextSteps>
          <Step title="Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den Termin.">
            <KernBody>{termin}</KernBody>
            <CopyButton
              text={details}
              label="Termindetails kopieren"
              copiedLabel="Termindetails kopiert"
              announcement="Die Termindetails wurden kopiert."
              className="kern-btn--small"
            />
          </Step>
          <Step title="Ihre Servicestelle verschickt die Ladung." />
        </NextSteps>
      </KernStack>
    </AppShell>
  );
}
