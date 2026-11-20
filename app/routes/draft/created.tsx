import { data, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernStack } from "~/components/shared/kern/KernStack";
import { NextSteps, Step, SuccessBanner } from "~/components/shared/NextSteps";
import { SurveyLinkField } from "~/components/shared/SurveyLinkField";
import { getDb } from "~/database/database";
import { BASE_PATH } from "~/lib/base-path";

import { createTerminBreadcrumbs } from "./breadcrumbs";
import { groupSlotsByDay } from "./slot-days";
import { rangeToSlot } from "./slots";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  // A draft has not been published yet, so there is nothing to share.
  if (appointment.status === "draft") throw redirect(`/overview/${encodeURIComponent(id)}/confirm`);

  // Published appointments always have their token.
  if (!appointment.universalToken) throw data("Not found", { status: 404 });

  const { origin } = new URL(request.url);
  return {
    user,
    days: groupSlotsByDay(appointment.slots.map(rangeToSlot)),
    surveyUrl: `${origin}${BASE_PATH}/umfrage/${encodeURIComponent(appointment.universalToken)}`,
  };
}

export default function CreateTerminCreated() {
  const { user, days, surveyUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <KernStack className="next-steps__page">
        <SuccessBanner title="Sie haben die Terminumfrage erstellt." />

        <NextSteps>
          <Step title="Halten Sie sich die vorgeschlagenen Zeitfenster frei.">
            <KernDescriptionList>
              {days.map(({ key, label, times }) => (
                <KernDescriptionListItem key={key} label={label}>
                  <ul className="next-steps__times">
                    {times.map((time) => (
                      <li key={time}>{time}</li>
                    ))}
                  </ul>
                </KernDescriptionListItem>
              ))}
            </KernDescriptionList>
          </Step>
          <Step title="Teilen Sie den Link zur Terminumfrage mit allen Verfahrensbeteiligten.">
            <KernBody>Erwähnen Sie, bis wann Sie sich eine Rückmeldung wünschen.</KernBody>
            <SurveyLinkField id="survey-link" url={surveyUrl} />
          </Step>
          <Step title="Alle Verfahrensbeteiligten geben Ihre Verfügbarkeiten an." />
          <Step title="Wählen Sie einen passenden Termin aus." />
          <Step title="Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den ausgewählten Termin." />
          <Step title="Die Servicestelle verschickt die Ladung." />
        </NextSteps>
      </KernStack>
    </AppShell>
  );
}
