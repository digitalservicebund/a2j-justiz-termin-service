import { data, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { SurveyLinkField } from "~/components/shared/SurveyLinkField";
import { getDb } from "~/database/database";
import { BASE_PATH } from "~/lib/base-path";

import { createTerminBreadcrumbs, groupSlotsByDay } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";

import "./create-termin.created.css";

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

export function Step({ title, children }: Readonly<{ title: string; children?: React.ReactNode }>) {
  return (
    <KernCluster
      as="li"
      wrap={false}
      gap="md"
      align="start"
      className="create-termin-created__step"
    >
      <KernStack
        gap="sm"
        align="start"
        className="create-termin-created__step-body kern-flex-1 kern-pt-xs"
      >
        <KernHeading size="title" level={3} margin="none">
          {title}
        </KernHeading>
        {children}
      </KernStack>
    </KernCluster>
  );
}

// Success banner and the numbered steps that follow, shared with the page after choosing a Termin.
// The link back to the judge's overview is left out for guests, who have no overview.
export function SuccessBanner({
  title,
  overviewLink = true,
}: Readonly<{ title: string; overviewLink?: boolean }>) {
  return (
    <ResultBanner
      type="success"
      title={title}
      actions={
        <>
          <a className="kern-btn kern-btn--primary" href="#naechste-schritte">
            <KernLabel>Nächste Schritte</KernLabel>
            <KernIcon name="arrow-down" />
          </a>
          {overviewLink && (
            <KernLinkButton style="secondary" to="/overview">
              <KernLabel>Zu den Terminumfragen</KernLabel>
              <KernIcon name="arrow-forward" />
            </KernLinkButton>
          )}
        </>
      }
    />
  );
}

// The heading and the numbered steps, for pages that lay out their own content column.
export function NextStepsSection({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <KernStack as="section" gap="md" aria-labelledby="naechste-schritte">
      <KernHeading size="large" level={2} id="naechste-schritte">
        Nächste Schritte
      </KernHeading>
      <KernStack as="ol" className="create-termin-created__list">
        {children}
      </KernStack>
    </KernStack>
  );
}

export function NextSteps({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DefaultPage>
      <NextStepsSection>{children}</NextStepsSection>
    </DefaultPage>
  );
}

export default function CreateTerminCreated() {
  const { user, days, surveyUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <KernStack className="create-termin-created">
        <SuccessBanner title="Sie haben die Terminumfrage erstellt." />

        <NextSteps>
          <Step title="Halten Sie sich die vorgeschlagenen Zeitfenster frei.">
            <KernDescriptionList>
              {days.map(({ key, label, times }) => (
                <KernDescriptionListItem key={key} label={label}>
                  <ul className="create-termin-review__times">
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
