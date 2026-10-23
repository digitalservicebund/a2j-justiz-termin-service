import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { findSurvey } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernButton } from "~/components/shared/kern/KernButton";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
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
      <FlowPage width="wide" className="survey">
        <div className="survey__layout">
          <KernDescriptionList column className="survey__facts">
            <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
          </KernDescriptionList>

          <Form method="post" className="survey__form" noValidate>
            <KernHeading size="large" level={1}>
              Geben Sie Ihre Verfügbarkeiten an
            </KernHeading>

            {needsName && (
              <KernFormInput
                id="name"
                label="Ihr Name"
                className="survey__name"
                error={errors.name}
                name="name"
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                defaultValue={values.name}
              />
            )}

            <KernFieldset
              id="zeitfenster"
              legend="Verfügbarkeiten"
              hideLegend
              className="survey__fieldset"
              bodyClassName="survey__days"
              error={errors.slots}
            >
              {days.map(({ key, label, windows }) => (
                <div className="survey__day" key={key}>
                  <KernHeading size="medium" level={2} className="survey__date">
                    {label}
                  </KernHeading>
                  <div className="survey__windows">
                    {windows.map(({ id, time }) => (
                      <div className="survey__window" key={id}>
                        <h3 className="kern-body kern-body--large kern-body--bold survey__time">
                          {time}
                        </h3>
                        <KernFormCheck
                          id={`fenster-${id}`}
                          type="checkbox"
                          label={
                            <>
                              Verfügbar
                              <span className="kern-sr-only">{` am ${label}, ${time}`}</span>
                            </>
                          }
                          name="verfuegbar"
                          value={id}
                          defaultChecked={values.available.includes(id)}
                          invalid={Boolean(errors.slots)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <KernFormCheck
                id="keines"
                type="checkbox"
                label="Kein Zeitfenster passt"
                name="keines"
                value="1"
                defaultChecked={values.none}
                invalid={Boolean(errors.slots)}
              />
            </KernFieldset>

            <div className="survey__actions">
              <KernButton type="submit" disabled={pending}>
                Weiter
              </KernButton>
            </div>
          </Form>
        </div>
      </FlowPage>
    </AppShell>
  );
}
