import { useLoaderData } from "react-router";

import { AppShell } from "~/components/shared/AppShell";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernStack } from "~/components/shared/kern/KernStack";
import { NextSteps, Step, SuccessBanner } from "~/components/shared/NextSteps";
import { SurveyLinkField } from "~/components/shared/SurveyLinkField";
import { PUBLISHED, requireOwnAppointment } from "~/lib/appointment-guard.server";
import { confirmDraftPath, surveyUrl } from "~/lib/paths";
import { notFound } from "~/lib/responses";

import { createTerminBreadcrumbs } from "./breadcrumbs";
import { groupSlotsByDay } from "./slot-days";
import { rangeToSlot } from "./slots";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  // A draft has not been published yet, so there is nothing to share.
  const { user, appointment } = await requireOwnAppointment(request, params, {
    status: PUBLISHED,
    otherwise: confirmDraftPath,
  });

  // Published appointments always have their token.
  if (!appointment.universalToken) throw notFound();

  const { origin } = new URL(request.url);
  return {
    user,
    days: groupSlotsByDay(appointment.slots.map(rangeToSlot)),
    surveyUrl: surveyUrl(origin, appointment.universalToken),
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
