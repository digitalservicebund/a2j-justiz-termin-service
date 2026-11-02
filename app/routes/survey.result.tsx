import { data, redirect, useLoaderData } from "react-router";

import { findSurvey, getSavedAnswer } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { DefaultPage } from "~/components/shared/DefaultPage";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { getDb } from "~/database/database";

import { NextSteps, Step, SuccessBanner } from "./create-termin.created";
import {
  groupWindows,
  noMatchBreadcrumbs,
  surveyBreadcrumbs,
  surveyPath,
  type SurveyDay,
} from "./survey.schema";

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

  const days = groupWindows(answer.available);
  return {
    days,
    // Only the sorry page shows these: what was proposed, once nothing is left to choose from.
    aktenzeichen: survey.aktenzeichen,
    proposedDays: days.length === 0 ? groupWindows(survey.proposedSlots) : [],
  };
}

export default function SurveyResult() {
  const { days, aktenzeichen, proposedDays } = useLoaderData<typeof loader>();
  if (days.length === 0) return <NoOption aktenzeichen={aktenzeichen} days={proposedDays} />;
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
export function NoOption({
  aktenzeichen,
  days,
}: Readonly<{ aktenzeichen: string; days: SurveyDay[] }>) {
  return (
    <AppShell breadcrumbs={noMatchBreadcrumbs}>
      <div className="survey-result survey-result--no-match">
        <DefaultPage width="content">
          <div className="survey-no-match">
            <ResultBanner
              inline
              type="warning"
              title="Es gibt leider kein Zeitfenster, dass allen Verfahrensbeteiligten passt."
              message="Das Gericht wird wahrscheinlich eine neue Terminumfrage erstellen."
            />
            <section
              aria-labelledby="no-match-verhandlungsdaten"
              className="survey-no-match__section"
            >
              <KernHeading size="medium" level={2} id="no-match-verhandlungsdaten">
                Verhandlungsdaten
              </KernHeading>
              <KernDescriptionList column>
                <KernDescriptionListItem label="Aktenzeichen">
                  {aktenzeichen}
                </KernDescriptionListItem>
              </KernDescriptionList>
            </section>
            {days.length > 0 && (
              <section aria-labelledby="no-match-zeitfenster" className="survey-no-match__section">
                <KernHeading size="medium" level={2} id="no-match-zeitfenster">
                  Zeitfenster
                </KernHeading>
                <KernDescriptionList className="survey-no-match__windows">
                  {days.map(({ key, label, windows }) => (
                    <KernDescriptionListItem key={key} label={label}>
                      {windows.map(({ id, time }) => (
                        <div key={id}>{time}</div>
                      ))}
                    </KernDescriptionListItem>
                  ))}
                </KernDescriptionList>
              </section>
            )}
          </div>
        </DefaultPage>
      </div>
    </AppShell>
  );
}
