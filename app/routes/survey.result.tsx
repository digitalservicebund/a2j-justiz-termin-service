import { data, redirect, useLoaderData } from "react-router";

import { findSurvey, getSavedAnswer } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { getDb } from "~/database/database";

import { NextSteps, Step, SuccessBanner } from "./create-termin.created";
import { groupWindows, surveyBreadcrumbs, surveyPath } from "./survey.schema";

import "./create-termin.created.css";
import "./survey.css";

type Params = { params: { token?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const token = params.token ?? "";
  const survey = await findSurvey(getDb(), token);
  if (!survey) throw data("Not found", { status: 404 });

  // Whoever has not answered yet is sent to the form; the participant id is only known after saving.
  const participantId = new URL(request.url).searchParams.get("teilnehmer") ?? "";
  const answer = participantId
    ? await getSavedAnswer(getDb(), survey.appointmentId, participantId)
    : undefined;
  if (!answer) throw redirect(surveyPath(token));

  return { days: groupWindows(answer.available) };
}

export default function SurveyResult() {
  const { days } = useLoaderData<typeof loader>();
  if (days.length === 0) return <NoOption />;
  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <div className="create-termin-created survey-result">
        <Positive days={days} />
      </div>
    </AppShell>
  );
}

function Positive({ days }: Readonly<{ days: ReturnType<typeof groupWindows> }>) {
  return (
    <>
      <SuccessBanner title="Danke für das Angeben Ihrer Verfügbarkeiten." overviewLink={false} />

      <NextSteps>
        <Step title="Halten Sie sich die angegebenen Zeitfenster frei, bis vom Gericht ein Termin festgelegt wurde.">
          <KernDescriptionList>
            {days.map(({ key, label, windows }) => (
              <KernDescriptionListItem key={key} label={label}>
                <ul className="create-termin-review__times">
                  {windows.map(({ id, start }) => (
                    <li key={id}>{start}</li>
                  ))}
                </ul>
              </KernDescriptionListItem>
            ))}
          </KernDescriptionList>
        </Step>
        <Step title="Alle anderen Verfahrensbeteiligten geben Ihre Verfügbarkeiten an." />
        <Step title="Das Gericht legt einen passenden Termin fest." />
        <Step title="Sie erhalten die Ladung." />
      </NextSteps>
    </>
  );
}

// Also shown right away when no window is left to answer.
export function NoOption() {
  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <div className="create-termin-created survey-result">
        <NoTimeWorks />
      </div>
    </AppShell>
  );
}

function NoTimeWorks() {
  return (
    <div className="kern-alert kern-alert--danger page-width page-width--wide create-termin-created__banner">
      <KernIcon name="danger" size="x-large" />
      <div className="create-termin-created__banner-body survey-result__banner-body">
        <KernHeading size="large" level={1}>
          Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.
        </KernHeading>
        <KernBody bold>Das Gericht wird wahrscheinlich eine neue Terminumfrage erstellen.</KernBody>
      </div>
    </div>
  );
}
