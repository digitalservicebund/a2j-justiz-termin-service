import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { findSurvey } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernGrid, KernGridCol } from "~/components/shared/kern/KernGrid";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernStack } from "~/components/shared/kern/KernStack";
import { resetClassName, stackClassName } from "~/components/shared/kern/layout";
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
    // Only listed once every window is ruled out, on the sorry page.
    proposedDays: survey.slots.length === 0 ? groupWindows(survey.proposedSlots) : [],
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
  const {
    aktenzeichen,
    needsName,
    days,
    proposedDays,
    values: saved,
  } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the guest just submitted wins over the earlier answer.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};

  // Without any window left there is nothing to answer, so the guest hears that right away.
  if (days.length === 0) return <NoOption aktenzeichen={aktenzeichen} days={proposedDays} />;

  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <FlowPage width="wide">
        {/* The Aktenzeichen takes a column of its own next to the form on wide screens. */}
        <KernGrid align="start" gapY="xl">
          <KernGridCol lg={5}>
            <KernDescriptionList column>
              <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
            </KernDescriptionList>
          </KernGridCol>

          <KernGridCol lg={7}>
            <Form method="post" className={stackClassName({ gap: "xl" }, "form")} noValidate>
              <KernHeading size="large" level={1}>
                Geben Sie Ihre Verfügbarkeiten an
              </KernHeading>

              {needsName && (
                <KernGrid>
                  <KernGridCol md={6}>
                    <KernFormInput
                      id="name"
                      label="Ihr Name"
                      className="kern-w-full"
                      error={errors.name}
                      name="name"
                      autoComplete="name"
                      maxLength={MAX_NAME_LENGTH}
                      defaultValue={values.name}
                    />
                  </KernGridCol>
                </KernGrid>
              )}

              <KernFieldset
                id="zeitfenster"
                legend="Verfügbarkeiten"
                hideLegend
                className={`survey__fieldset ${resetClassName}`}
                bodyClassName={`survey__days ${stackClassName()}`}
                error={errors.slots}
              >
                {days.map(({ key, label, windows }) => (
                  <KernGrid align="start" gapY="md" key={key}>
                    <KernGridCol md={5}>
                      <KernHeading size="medium" level={2} margin="none">
                        {label}
                      </KernHeading>
                    </KernGridCol>
                    <KernGridCol md={7}>
                      <KernStack gap="md">
                        {windows.map(({ id, time }) => (
                          <KernCluster gap="lg" align="center" className="survey__window" key={id}>
                            <h3 className="kern-body kern-body--large kern-body--bold kern-m-none">
                              {time}
                            </h3>
                            <KernFormCheck
                              id={`fenster-${id}`}
                              type="checkbox"
                              label={
                                <>
                                  Verfügbar{" "}
                                  <span className="kern-sr-only">{`am ${label}, ${time}`}</span>
                                </>
                              }
                              name="verfuegbar"
                              value={id}
                              defaultChecked={values.available.includes(id)}
                              invalid={Boolean(errors.slots)}
                            />
                          </KernCluster>
                        ))}
                      </KernStack>
                    </KernGridCol>
                  </KernGrid>
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

              <KernCluster gap="md" className="kern-pt-md">
                <KernButton type="submit" disabled={pending}>
                  Weiter
                </KernButton>
              </KernCluster>
            </Form>
          </KernGridCol>
        </KernGrid>
      </FlowPage>
    </AppShell>
  );
}
