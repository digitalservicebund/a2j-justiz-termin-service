import { data, redirect, useLoaderData } from "react-router";

import { findSurvey, saveAnswer } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { getDb } from "~/database/database";

import { ReviewItem, ReviewPage } from "./create-termin.review";
import {
  describeAnswers,
  groupWindows,
  readValues,
  surveyBreadcrumbs,
  surveyPath,
  surveySearch,
  validateSurvey,
} from "./survey.schema";

import "./survey.css";

type Params = { params: { token?: string } };

async function loadSurvey({ params }: Params) {
  const token = params.token ?? "";
  const survey = await findSurvey(getDb(), token);
  if (!survey) throw data("Not found", { status: 404 });
  return { token, survey };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { token, survey } = await loadSurvey({ params });
  const values = readValues(new URL(request.url).searchParams);
  const needsName = !survey.participant;
  const days = groupWindows(survey.slots);

  // Without a valid answer there is nothing to review, so the guest answers again.
  const result = validateSurvey(values, { needsName, slotIds: survey.slots.map(({ id }) => id) });
  if (!result.success) throw redirect(`${surveyPath(token)}?${surveySearch(values)}`);

  return {
    values,
    needsName,
    aktenzeichen: survey.aktenzeichen,
    name: survey.participant?.name ?? result.name,
    answers: describeAnswers(days, result.availableSlotIds),
    // Which design the review follows: without any window the guest is not available at all.
    none: result.availableSlotIds.length === 0,
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const { token, survey } = await loadSurvey({ params });
  const form = await request.formData();
  const intent = form.get("intent");
  const values = readValues(form);
  const back = `${surveyPath(token)}?${surveySearch(values)}`;

  if (intent === "back") return redirect(back);
  if (intent !== "finish") throw data("Bad request", { status: 400 });

  const result = validateSurvey(values, {
    needsName: !survey.participant,
    slotIds: survey.slots.map(({ id }) => id),
  });
  if (!result.success) return redirect(back);

  const saved = await saveAnswer(getDb(), {
    appointmentId: survey.appointmentId,
    name: survey.participant?.name ?? result.name,
    participantId: survey.participant?.id,
    availableSlotIds: result.availableSlotIds,
  });
  // Another answer ruled a window out in the meantime, or the survey closed: the form shows
  // what is left, or the page is gone.
  if (!saved.saved) return redirect(back);
  return redirect(
    `${surveyPath(token, "/naechste-schritte")}?teilnehmer=${encodeURIComponent(saved.participantId)}`,
  );
}

export default function SurveyConfirm() {
  const { values, needsName, aktenzeichen, name, answers } = useLoaderData<typeof loader>();
  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <ReviewPage
        className="survey-confirm"
        sections={[
          {
            id: "verhandlungsdaten",
            title: "Verhandlungsdaten",
            editable: false,
            children: (
              <dl className="kern-description-list">
                <ReviewItem label="Aktenzeichen">{aktenzeichen}</ReviewItem>
              </dl>
            ),
          },
          {
            id: "teilnehmer",
            title: "Ihre Daten",
            // A personal link already names the guest.
            editable: needsName,
            children: (
              <dl className="kern-description-list">
                <ReviewItem label="Name">{name}</ReviewItem>
              </dl>
            ),
          },
          {
            id: "zeitfenster",
            title: "Zeitfenster",
            children: (
              <dl className="kern-description-list">
                {answers.map(({ key, label, lines }) => (
                  <ReviewItem key={key} label={label}>
                    <ul className="create-termin-review__times">
                      {lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </ReviewItem>
                ))}
              </dl>
            ),
          },
        ]}
        submit={{ label: "Terminumfrage abschließen", intent: "finish" }}
      >
        {needsName && <input type="hidden" name="name" value={values.name} />}
        {values.available.map((id) => (
          <input key={id} type="hidden" name="verfuegbar" value={id} />
        ))}
        {values.none && <input type="hidden" name="keines" value="1" />}
      </ReviewPage>
    </AppShell>
  );
}
