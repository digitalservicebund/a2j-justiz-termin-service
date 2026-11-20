import {
  data,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";

import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { FieldColumn, FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
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
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { classNames, resetClassName, stackClassName } from "~/components/shared/kern/layout";
import { surveyPath, surveyResultPath, surveySummaryPath } from "~/lib/paths";
import { requireSurvey } from "~/lib/survey-guard.server";

import { NoOption } from "./result";
import {
  groupWindows,
  MAX_NAME_LENGTH,
  offerViews,
  readValues,
  removeWindow,
  surveyBreadcrumbs,
  surveySearch,
  validateSurvey,
  type OfferView,
} from "./schema";
import { draftPath, offerAnchor, smallerWindowPath } from "./window.paths";

import "./survey.css";

type Params = { params: { token?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const { token, survey } = await requireSurvey(params);
  // A personal link answers once.
  if (survey.answered && survey.participant) {
    throw redirect(surveyResultPath(token, survey.participant.id));
  }

  return {
    aktenzeichen: survey.aktenzeichen,
    needsName: !survey.participant,
    days: groupWindows(survey.slots),
    // Cancelling throws the draft away: the survey starts afresh.
    cancelHref: surveyPath(token),
    // Only listed once every window is ruled out, on the sorry page.
    proposedDays: survey.slots.length === 0 ? groupWindows(survey.proposedSlots) : [],
    // Going back from the review brings the earlier answer along.
    values: readValues(new URL(request.url).searchParams),
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const { token, survey } = await requireSurvey(params);
  // Nothing can be answered without a window; the form page says so.
  if (survey.slots.length === 0) return redirect(surveyPath(token));
  const form = await request.formData();
  const values = readValues(form);

  // Adding, changing and removing a smaller window keep the draft, without checking it yet.
  const [command, offerKey = "", windowKey] = String(form.get("intent") ?? "").split(":");
  if (command === "add" || command === "edit") {
    return redirect(smallerWindowPath(token, values, offerKey, windowKey));
  }
  if (command === "delete") {
    const available = removeWindow(values.available, windowKey ?? "");
    return redirect(draftPath(token, { ...values, available }, offerKey));
  }

  const result = validateSurvey(values, {
    needsName: !survey.participant,
    offered: survey.slots,
    minDurationMinutes: survey.minDurationMinutes,
  });
  if (!result.success) return data({ values, errors: result.errors }, { status: 400 });
  return redirect(surveySummaryPath(token, surveySearch(values)));
}

export default function Survey() {
  const {
    aktenzeichen,
    needsName,
    days,
    proposedDays,
    cancelHref,
    values: saved,
  } = useLoaderData<typeof loader>();
  // Every navigation fills the form afresh from its draft, also cancelling to the same address.
  const location = useLocation();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the guest just submitted wins over the earlier answer.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};
  const views = offerViews(
    days.flatMap(({ windows }) => windows.map(({ id }) => id)),
    values.available,
  );

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
            <FormStack method="post" noValidate key={location.key}>
              {/* Pressing Enter in a field submits the first button, which has to be "Weiter". */}
              <button type="submit" name="intent" value="next" hidden tabIndex={-1} />
              <KernHeading size="large" level={1}>
                Geben Sie Ihre Verfügbarkeiten an
              </KernHeading>

              {needsName && (
                <FieldColumn size="small">
                  <KernFormInput
                    id="name"
                    label="Ihr Name"
                    wrapperClassName="kern-w-full"
                    error={errors.name}
                    name="name"
                    autoComplete="name"
                    maxLength={MAX_NAME_LENGTH}
                    defaultValue={values.name}
                  />
                </FieldColumn>
              )}

              <KernFieldset
                id="zeitfenster"
                legend="Verfügbarkeiten"
                hideLegend
                className={classNames("survey__fieldset", resetClassName)}
                bodyClassName={classNames("survey__days", stackClassName())}
                error={errors.slots}
              >
                {days.map(({ key, label, weekday, windows }) => (
                  <KernGrid align="start" gapY="md" key={key}>
                    <KernGridCol md={5}>
                      <KernHeading className="kern-m-none" size="medium" level={2}>
                        {label}
                      </KernHeading>
                      <p className="kern-preline kern-preline--small kern-m-none">{weekday}</p>
                    </KernGridCol>
                    <KernGridCol md={7}>
                      <KernStack gap="md">
                        {windows.map(({ id, time }) => (
                          <Offer
                            key={id}
                            id={id}
                            day={label}
                            time={time}
                            view={views.get(id) ?? { state: "none", windows: [] }}
                            invalid={Boolean(errors.slots)}
                          />
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

              <FormActions>
                <KernLinkButton style="secondary" to={cancelHref}>
                  <KernLabel>Abbrechen</KernLabel>
                </KernLinkButton>
                <KernButton type="submit" name="intent" value="next" disabled={pending}>
                  Weiter
                </KernButton>
              </FormActions>
            </FormStack>
          </KernGridCol>
        </KernGrid>
      </FlowPage>
    </AppShell>
  );
}

type OfferProps = {
  // The key of the offered window.
  id: string;
  day: string;
  time: string;
  view: OfferView;
  invalid: boolean;
};

// One offered window: a box to tick when the guest is available for all of it, or the smaller
// windows the guest added, which can be changed and removed. More can be added either way.
function Offer({ id, day, time, view, invalid }: Readonly<OfferProps>) {
  const where = `am ${day}, ${time}`;
  return (
    <div className="survey__offer" id={offerAnchor(id)}>
      <KernCluster gap="md" align="center" className="survey__window">
        <h3 className="kern-body kern-body--large kern-body--bold kern-m-none">{time}</h3>
        {view.state === "partial" ? (
          <KernBody className="kern-m-none">Teilweise verfügbar</KernBody>
        ) : (
          <KernFormCheck
            // A tick that a smaller window replaced or brought back comes from the draft again.
            key={view.state}
            id={`fenster-${id}`}
            type="checkbox"
            label={
              <>
                Verfügbar <span className="kern-sr-only">{where}</span>
              </>
            }
            name="verfuegbar"
            value={id}
            defaultChecked={view.state === "full"}
            invalid={invalid}
          />
        )}
      </KernCluster>

      {view.state === "partial" && (
        <ul className="survey__smaller" aria-label={`Kleinere Zeitfenster ${where}`}>
          {view.windows.map((window) => (
            <li key={window.key} className="survey__smaller-window">
              <KernBody className="kern-m-none">{window.time} – verfügbar</KernBody>
              <input type="hidden" name="verfuegbar" value={window.key} />
              <KernButton
                type="submit"
                name="intent"
                value={`edit:${id}:${window.key}`}
                style="tertiary"
                aria-label={`Zeitfenster ${window.time} ${where} ändern`}
              >
                <KernIcon name="edit" />
              </KernButton>
              <KernButton
                type="submit"
                name="intent"
                value={`delete:${id}:${window.key}`}
                style="tertiary"
                aria-label={`Zeitfenster ${window.time} ${where} löschen`}
              >
                <KernIcon name="delete" />
              </KernButton>
            </li>
          ))}
        </ul>
      )}

      <KernButton
        type="submit"
        name="intent"
        value={`add:${id}`}
        style="tertiary"
        className="kern-btn--x-small survey__add"
        // Not a hidden span: KERN shrinks an x-small button with one to an icon button.
        aria-label={`Kleineres Zeitfenster hinzufügen ${where}`}
      >
        <KernIcon name="add" size="small" />
        <KernLabel>Kleineres Zeitfenster hinzufügen</KernLabel>
      </KernButton>
    </div>
  );
}
