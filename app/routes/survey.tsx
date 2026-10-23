import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { findSurvey } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { Button } from "~/components/shared/Button";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { getDb } from "~/database/database";

import { NoOption } from "./survey.result";
import {
  groupWindows,
  MAX_NAME_LENGTH,
  readValues,
  surveyBreadcrumbs,
  surveyPath,
  surveySearch,
  validateSurvey,
} from "./survey.schema";

import "./survey.css";

type Params = { params: { token?: string } };

// Only an open survey can be answered. Unknown links look the same as closed ones.
async function loadSurvey({ params }: Params) {
  const token = params.token ?? "";
  const survey = await findSurvey(getDb(), token);
  if (!survey) throw data("Not found", { status: 404 });
  return { token, survey };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { token, survey } = await loadSurvey({ params });
  // A personal link answers once.
  if (survey.answered && survey.participant) {
    throw redirect(
      `${surveyPath(token, "/naechste-schritte")}?teilnehmer=${encodeURIComponent(survey.participant.id)}`,
    );
  }

  return {
    aktenzeichen: survey.aktenzeichen,
    needsName: !survey.participant,
    days: groupWindows(survey.slots),
    // Going back from the review brings the earlier answer along.
    values: readValues(new URL(request.url).searchParams),
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const { token, survey } = await loadSurvey({ params });
  // Nothing can be answered without a window; the form page says so.
  if (survey.slots.length === 0) return redirect(surveyPath(token));
  const values = readValues(await request.formData());

  const result = validateSurvey(values, {
    needsName: !survey.participant,
    slotIds: survey.slots.map(({ id }) => id),
  });
  if (!result.success) return data({ values, errors: result.errors }, { status: 400 });
  return redirect(`${surveyPath(token, "/zusammenfassung")}?${surveySearch(values)}`);
}

export default function Survey() {
  const { aktenzeichen, needsName, days, values: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the guest just submitted wins over the earlier answer.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};

  // Without any window left there is nothing to answer, so the guest hears that right away.
  if (days.length === 0) return <NoOption />;

  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <FlowPage className="survey">
        <div className="survey__layout">
          <dl className="kern-description-list kern-description-list--col survey__facts">
            <div className="kern-description-list-item">
              <dt className="kern-description-list-item__key">Aktenzeichen</dt>
              <dd className="kern-description-list-item__value">{aktenzeichen}</dd>
            </div>
          </dl>

          <Form method="post" className="survey__form" noValidate>
            <h1 className="kern-heading-large">Geben Sie Ihre Verfügbarkeiten an</h1>

            {needsName && (
              <div className={`kern-form-input${errors.name ? " kern-form-input--error" : ""}`}>
                <label className="kern-label" htmlFor="name">
                  Ihr Name
                </label>
                <input
                  className={`kern-form-input__input survey__name${errors.name ? " kern-form-input__input--error" : ""}`}
                  id="name"
                  name="name"
                  autoComplete="name"
                  maxLength={MAX_NAME_LENGTH}
                  defaultValue={values.name}
                  aria-invalid={Boolean(errors.name) || undefined}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && <ErrorMessage id="name-error">{errors.name}</ErrorMessage>}
              </div>
            )}

            <fieldset
              className={`kern-fieldset survey__fieldset${errors.slots ? " kern-fieldset--error" : ""}`}
              aria-describedby={errors.slots ? "zeitfenster-error" : undefined}
            >
              <legend className="kern-sr-only">Verfügbarkeiten</legend>
              <div className="kern-fieldset__body survey__days">
                {days.map(({ key, label, windows }) => (
                  <div className="survey__day" key={key}>
                    <h2 className="kern-heading-medium survey__date">{label}</h2>
                    <div className="survey__windows">
                      {windows.map(({ id, time }) => (
                        <div className="survey__window" key={id}>
                          <h3 className="kern-body kern-body--large kern-body--bold survey__time">
                            {time}
                          </h3>
                          <div className="kern-form-check">
                            <input
                              className={`kern-form-check__checkbox${errors.slots ? " kern-form-check__checkbox--error" : ""}`}
                              id={`fenster-${id}`}
                              name="verfuegbar"
                              type="checkbox"
                              value={id}
                              defaultChecked={values.available.includes(id)}
                            />
                            <label className="kern-label" htmlFor={`fenster-${id}`}>
                              Verfügbar
                              <span className="kern-sr-only">{` am ${label}, ${time}`}</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="kern-form-check">
                  <input
                    className={`kern-form-check__checkbox${errors.slots ? " kern-form-check__checkbox--error" : ""}`}
                    id="keines"
                    name="keines"
                    type="checkbox"
                    value="1"
                    defaultChecked={values.none}
                  />
                  <label className="kern-label" htmlFor="keines">
                    Kein Zeitfenster passt
                  </label>
                </div>
              </div>
              {errors.slots && <ErrorMessage id="zeitfenster-error">{errors.slots}</ErrorMessage>}
            </fieldset>

            <div className="survey__actions">
              <Button type="submit" disabled={pending}>
                Weiter
              </Button>
            </div>
          </Form>
        </div>
      </FlowPage>
    </AppShell>
  );
}
