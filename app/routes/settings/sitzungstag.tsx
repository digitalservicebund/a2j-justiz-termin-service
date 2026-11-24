import { Fragment } from "react";
import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { requireRole } from "~/adapters/session/session";
import {
  addSitzungstag,
  listSitzungstage,
  updateSitzungstag,
} from "~/adapters/users/sitzungstage.server";
import { AppShell } from "~/components/shared/AppShell";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { classNames, clusterClassName } from "~/components/shared/kern/layout";
import { SidebarPage } from "~/components/shared/SidebarPage";
import { WEEKDAYS } from "~/core/domain/sitzungstag";
import { formatIsoWeekday } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { NEW_ITEM, SETTINGS_PATH } from "~/lib/web/paths";
import { notFound } from "~/lib/web/responses";

import { settingsBreadcrumbs } from "./breadcrumbs";
import {
  emptySitzungstag,
  parseSitzungstagForm,
  toSitzungstagInput,
  validateSitzungstag,
  type SitzungstagErrorGroup,
  type SitzungstagErrors,
  type SitzungstagField,
  type SitzungstagInput,
} from "./schema";

import "./sitzungstag.css";

type Params = { params: { sitzungstagId?: string } };

// The judge's Sitzungstage, and the one the page edits. A new one has none, and an id the judge
// does not have is not found.
async function load(request: Request, { params }: Params) {
  const user = await requireRole(request, "richter");
  const isNew = params.sitzungstagId === NEW_ITEM;
  const all = await listSitzungstage(getDb(), user.id);
  const current = all.find(({ id }) => id === params.sitzungstagId);
  if (!isNew && !current) throw notFound();
  return { user, isNew, current, others: all.filter((entry) => entry !== current) };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { user, current } = await load(request, { params });
  return { user, values: current ? toSitzungstagInput(current) : emptySitzungstag };
}

type ActionResult = { values: SitzungstagInput; errors: SitzungstagErrors };

export async function action({ request, params }: { request: Request } & Params) {
  const { user, current, others } = await load(request, { params });
  const values = parseSitzungstagForm(await request.formData());
  const result = validateSitzungstag(values, others);
  if (!result.success) {
    return data({ values, errors: result.errors } satisfies ActionResult, { status: 400 });
  }

  const db = getDb();
  if (current) {
    if (!(await updateSitzungstag(db, user.id, current.id, result.times))) throw notFound();
  } else {
    await addSitzungstag(db, user.id, result.times);
  }
  return redirect(SETTINGS_PATH);
}

type TimeField = { field: SitzungstagField; label: string };

const startFields: TimeField[] = [
  { field: "startHour", label: "Stunde" },
  { field: "startMinute", label: "Minute" },
];
const endFields: TimeField[] = [
  { field: "endHour", label: "Stunde" },
  { field: "endMinute", label: "Minute" },
];

// The errors shown under the times, in this order.
const timeGroups = ["start", "end", "range", "overlap"] as const;
const errorId = (group: SitzungstagErrorGroup) => `sitzungstag-${group}-error`;

const colonLayout = clusterClassName({ wrap: false, align: "center" });

export default function SitzungstagPage() {
  const { user, values: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  // What the user just submitted wins over the saved Sitzungstag.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};
  const shownTimeErrors = timeGroups.filter((group) => errors[group]);

  const timeInputs = (legend: string, group: "start" | "end", fields: TimeField[]) => {
    const flagged = Boolean(errors[group] || errors.overlap || (group === "end" && errors.range));
    return (
      <KernCluster as="fieldset" wrap={false} gap="sm" align="end">
        <legend className="kern-sr-only">{legend}</legend>
        {fields.map(({ field, label }, position) => (
          <Fragment key={field}>
            {position > 0 && (
              <span className={classNames("sitzungstag__colon", colonLayout)} aria-hidden="true">
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
              defaultValue={values[field]}
              // Remounts when a rejected submit brings back what was typed.
              key={values[field]}
            />
          </Fragment>
        ))}
      </KernCluster>
    );
  };

  return (
    <AppShell user={user} breadcrumbs={settingsBreadcrumbs}>
      <SidebarPage current="settings" user={user} tone="form">
        <FormStack method="post" noValidate className="sitzungstag">
          <KernStack gap="sm">
            <KernBody size="small" bold>
              Sitzungstage
            </KernBody>
            <KernHeading size="large" level={1}>
              Wann ist Ihr Sitzungstag und wann sind Ihre reguläre Verhandlungszeiten?
            </KernHeading>
          </KernStack>

          <KernBody>
            Diese Informationen werden genutzt, um wiederkehrende Angaben zu vermeiden.
          </KernBody>

          <KernFieldset id="weekday" legend="Sitzungstag" error={errors.weekday}>
            {WEEKDAYS.map((weekday) => (
              <KernFormCheck
                key={weekday}
                id={`weekday-${weekday}`}
                type="radio"
                name="weekday"
                value={String(weekday)}
                label={formatIsoWeekday(weekday)}
                invalid={Boolean(errors.weekday)}
                defaultChecked={values.weekday === String(weekday)}
              />
            ))}
          </KernFieldset>

          <fieldset
            className={classNames(
              "kern-fieldset",
              shownTimeErrors.length > 0 && "kern-fieldset--error",
            )}
            aria-describedby={shownTimeErrors.map(errorId).join(" ") || undefined}
          >
            <legend className="kern-label">Reguläre Verhandlungszeiten</legend>
            <div className="kern-fieldset__body">
              <KernCluster gap="sm" align="end">
                {timeInputs("Beginn", "start", startFields)}
                <span className="kern-body sitzungstag__word">bis</span>
                {timeInputs("Ende", "end", endFields)}
              </KernCluster>
            </div>
            {shownTimeErrors.map((group) => (
              <ErrorMessage id={errorId(group)} key={group}>
                {errors[group]}
              </ErrorMessage>
            ))}
          </fieldset>

          <FormActions>
            <KernLinkButton style="secondary" to={SETTINGS_PATH}>
              <KernLabel>Abbrechen</KernLabel>
            </KernLinkButton>
            <KernButton type="submit" disabled={pending}>
              Speichern
            </KernButton>
          </FormActions>
        </FormStack>
      </SidebarPage>
    </AppShell>
  );
}
