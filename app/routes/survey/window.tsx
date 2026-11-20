import { Fragment } from "react";
import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { findSurvey } from "~/adapters/appointments/survey.server";
import { AppShell } from "~/components/shared/AppShell";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernGrid, KernGridCol } from "~/components/shared/kern/KernGrid";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { classNames, clusterClassName } from "~/components/shared/kern/layout";
import { contains, parseWindowKey, type SlotWindow } from "~/core/domain/availability";
import { formatRangeLong, formatTime } from "~/core/domain/time/format";
import type { TimeRange } from "~/core/domain/time/time-range";
import { getDb } from "~/database/database";

import { readValues, setSmallerWindow, surveyBreadcrumbs, surveyPath } from "./schema";
import { draftPath } from "./window.paths";
import {
  validateSmallerWindow,
  type WindowErrors,
  type WindowValues,
} from "./window.validate.server";

import "../draft/slot.css";
import "./survey.css";

type Params = { params: { token?: string } };

// The offered window the guest adds a smaller one to, and the window being changed, if any. A
// window that is no longer offered sends the guest back to the survey, which shows what is left.
async function loadOffer(request: Request, { params }: Params) {
  const token = params.token ?? "";
  const survey = await findSurvey(getDb(), token);
  if (!survey) throw data("Not found", { status: 404 });

  const search = new URL(request.url).searchParams;
  const values = readValues(search);
  if (survey.answered && survey.participant) throw redirect(surveyPath(token));
  const offer = survey.slots.find(({ id }) => id === search.get("angebot"));
  if (!offer) throw redirect(draftPath(token, values));

  const changing = parseWindowKey(search.get("fenster") ?? "");
  const editing = changing && contains(offer, changing) ? search.get("fenster")! : undefined;
  return { token, survey, values, offer, editing, changing: editing ? changing : undefined };
}

const toFields = ({ start, end }: TimeRange): WindowValues => {
  const [startHour = "", startMinute = ""] = formatTime(start).split(":");
  const [endHour = "", endMinute = ""] = formatTime(end).split(":");
  return { startHour, startMinute, endHour, endMinute };
};

function readFields(form: FormData): WindowValues {
  const read = (key: keyof WindowValues) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    startHour: read("startHour"),
    startMinute: read("startMinute"),
    endHour: read("endHour"),
    endMinute: read("endMinute"),
  };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { token, survey, values, offer, changing } = await loadOffer(request, { params });
  return {
    aktenzeichen: survey.aktenzeichen,
    offer: formatRangeLong(offer),
    // A new window starts as the whole offered one, which the guest narrows down.
    fields: toFields(changing ?? offer),
    cancelHref: draftPath(token, values, offer.id),
    editing: Boolean(changing),
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const { token, survey, values, offer, editing } = await loadOffer(request, { params });
  const fields = readFields(await request.formData());

  // The guest's other windows in this offer, without the one being changed. A tick of the whole
  // offer is not one: the new window takes its place.
  const others = values.available
    .filter((key) => key !== editing && key !== offer.id)
    .map(parseWindowKey)
    .filter((window): window is SlotWindow => window !== undefined && contains(offer, window));

  const result = validateSmallerWindow(fields, offer, survey.minDurationMinutes, others);
  if (!result.success) return data({ fields, errors: result.errors }, { status: 400 });

  const available = setSmallerWindow(values.available, offer.id, result.window, editing);
  return redirect(draftPath(token, { ...values, available }, offer.id));
}

type FieldConfig = { field: keyof WindowValues; label: string };

const startFields: FieldConfig[] = [
  { field: "startHour", label: "Stunde" },
  { field: "startMinute", label: "Minute" },
];
const endFields: FieldConfig[] = [
  { field: "endHour", label: "Stunde" },
  { field: "endMinute", label: "Minute" },
];

const errorGroups = ["start", "end", "range"] as const;
const errorId = (group: keyof WindowErrors) => `zeitfenster-${group}-error`;
const colonLayout = clusterClassName({ wrap: false, align: "center" });

export default function SurveyWindow() {
  const {
    aktenzeichen,
    offer,
    fields: saved,
    cancelHref,
    editing,
  } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the guest just submitted wins over the prefilled times.
  const fields = result?.fields ?? saved;
  const errors: WindowErrors = result?.errors ?? {};
  const groups = errorGroups.filter((group) => errors[group]);

  const time = (legend: string, group: "start" | "end", configs: FieldConfig[]) => {
    const flagged = Boolean(errors[group] || errors.range);
    const described = [group, "range" as const]
      .filter((name) => errors[name])
      .map(errorId)
      .join(" ");
    return (
      <KernCluster
        as="fieldset"
        wrap={false}
        gap="sm"
        align="end"
        aria-describedby={described || undefined}
      >
        <legend className="kern-sr-only">{legend}</legend>
        {configs.map(({ field, label }, position) => (
          <Fragment key={field}>
            {position > 0 && (
              <span
                className={classNames(
                  "create-termin-slot__separator",
                  "create-termin-slot__separator--colon",
                  colonLayout,
                )}
                aria-hidden="true"
              >
                :
              </span>
            )}
            <KernFormInput
              id={field}
              name={field}
              label={label}
              compactLabel
              width={2}
              invalid={flagged}
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              defaultValue={fields[field]}
              // Remounts when a rejected submit brings back what was typed.
              key={fields[field]}
            />
          </Fragment>
        ))}
      </KernCluster>
    );
  };

  return (
    <AppShell breadcrumbs={surveyBreadcrumbs}>
      <FlowPage width="wide">
        <KernGrid align="start" gapY="xl">
          <KernGridCol lg={5}>
            <KernDescriptionList column>
              <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
            </KernDescriptionList>
          </KernGridCol>

          <KernGridCol lg={7}>
            <FormStack method="post" noValidate>
              <KernStack gap="md">
                <KernBody bold muted className="kern-m-none">
                  Verfügbarkeit
                </KernBody>
                <KernHeading size="large" level={1}>
                  {editing
                    ? "Ändern Sie das kleinere Zeitfenster"
                    : "Geben Sie ein kleineres Zeitfenster an"}
                </KernHeading>
                <KernHeading size="medium" level={2}>
                  {offer}
                </KernHeading>

                <KernStack as="fieldset" gap="sm">
                  <legend className="kern-label">Kleineres Zeitfenster</legend>
                  <KernCluster gap="sm" align="end" className="create-termin-slot__fields">
                    {time("Beginn", "start", startFields)}
                    <span className="kern-body create-termin-slot__word">bis</span>
                    {time("Ende", "end", endFields)}
                  </KernCluster>
                </KernStack>

                {groups.length > 0 && (
                  <KernStack gap="sm">
                    {groups.map((group) => (
                      <ErrorMessage id={errorId(group)} key={group}>
                        {errors[group]}
                      </ErrorMessage>
                    ))}
                  </KernStack>
                )}
              </KernStack>

              <FormActions>
                <KernLinkButton style="secondary" to={cancelHref}>
                  <KernLabel>Abbrechen</KernLabel>
                </KernLinkButton>
                <KernButton type="submit" disabled={pending}>
                  Speichern
                </KernButton>
              </FormActions>
            </FormStack>
          </KernGridCol>
        </KernGrid>
      </FlowPage>
    </AppShell>
  );
}
