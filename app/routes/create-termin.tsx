import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { flushSync } from "react-dom";
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  createDraftAppointment,
  getAppointment,
  updateDraftAppointment,
} from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { getDb } from "~/database/database";

import { AddWindows, ADD_DATE_ID } from "./create-termin.add-windows";
import {
  normalizeDate,
  normalizeTime,
  berlinToday,
  parseDate,
  slotToWindow,
  sortWindows,
  weekdayShort,
  windowToSlot,
  type WindowText,
} from "./create-termin.entry";
import { createTerminBreadcrumbs } from "./create-termin.review";
import {
  isEmptySlot,
  MAX_SLOTS,
  MIN_SLOTS,
  parseCreateTerminForm,
  validateCreateTermin,
  type CreateTerminErrors,
  type CreateTerminValues,
  type SlotErrorGroup,
  type SlotField,
  type SlotInput,
} from "./create-termin.schema";
import { rangeToSlot, slotToRange } from "./create-termin.slots";

import "./create-termin.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const draftId = new URL(request.url).searchParams.get("entwurf");
  if (!draftId) return { user, draft: null };

  // Going back from the review reopens the saved draft.
  const appointment = await getAppointment(getDb(), user.id, draftId);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status !== "draft") throw redirect("/overview");
  return {
    user,
    draft: {
      id: appointment.id,
      values: {
        aktenzeichen: appointment.aktenzeichen,
        slots: appointment.slots.map(rangeToSlot),
      },
    },
  };
}

export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const formData = await request.formData();
  const values = parseCreateTerminForm(formData);

  const result = validateCreateTermin(values);
  if (!result.success) {
    return data({ values, errors: result.errors }, { status: 400 });
  }

  const appointment = {
    aktenzeichen: values.aktenzeichen.trim(),
    slots: values.slots.filter((slot) => !isEmptySlot(slot)).map(slotToRange),
  };
  const draftId = formData.get("appointmentId");
  if (typeof draftId === "string" && draftId) {
    const updated = await updateDraftAppointment(getDb(), user.id, draftId, appointment);
    if (!updated) throw data("Not found", { status: 404 });
    return redirect(`/overview/${encodeURIComponent(draftId)}/confirm`);
  }

  const id = await createDraftAppointment(getDb(), user.id, appointment);
  return redirect(`/overview/${id}/confirm`);
}

// The windows are kept as the text of their fields. What is posted are hidden fields in the
// shape the server validates, so the page works the same as when every part had its own input.
type Row = WindowText & { id: number };
type RowField = keyof WindowText;

const slotFieldNames = [
  "day",
  "month",
  "year",
  "startHour",
  "startMinute",
  "endHour",
  "endMinute",
] as const satisfies SlotField[];

const fieldOfGroup: Record<SlotErrorGroup, RowField> = {
  date: "date",
  start: "start",
  end: "end",
  range: "end",
  overlap: "date",
};

const fieldId = (index: number, field: RowField) => `slots-${index}-${field}`;
const SLOTS_ERROR_ID = "slots-error";
const rowErrorId = (id: number, group: SlotErrorGroup) => `row-${id}-${group}-error`;

function initialRows(values?: SlotInput[]): Row[] {
  return (values ?? []).map((slot, id) => ({ id, ...slotToWindow(slot) }));
}

// Errors are keyed by row id, not index, so they follow a row when others are removed.
type ErrorKey = "aktenzeichen" | "slots" | `${number}:${SlotErrorGroup}`;
type KeyedErrors = Partial<Record<ErrorKey, string>>;

function keyErrors(errors: CreateTerminErrors, rows: Row[]): KeyedErrors {
  const keyed: KeyedErrors = {};
  if (errors.aktenzeichen) keyed.aktenzeichen = errors.aktenzeichen;
  if (errors.slots) keyed.slots = errors.slots;
  for (const [index, groups] of Object.entries(errors.rows)) {
    const row = rows[Number(index)];
    if (!row) continue;
    for (const [group, message] of Object.entries(groups)) {
      keyed[`${row.id}:${group as SlotErrorGroup}`] = message;
    }
  }
  return keyed;
}

function firstErrorTarget(errors: CreateTerminErrors): string | null {
  if (errors.aktenzeichen) return "aktenzeichen";
  const [index] = Object.keys(errors.rows)
    .map(Number)
    .sort((a, b) => a - b);
  if (index !== undefined) {
    const [group] = Object.keys(errors.rows[index]!) as SlotErrorGroup[];
    return fieldId(index, fieldOfGroup[group!]);
  }
  return errors.slots ? ADD_DATE_ID : null;
}

type Result = { values: CreateTerminValues; errors: CreateTerminErrors };

export default function CreateTermin() {
  const { user, draft } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <CreateTerminForm draft={draft} result={result} />
    </AppShell>
  );
}

function CreateTerminForm({
  draft,
  result,
}: Readonly<{ draft: { id: string; values: CreateTerminValues } | null; result?: Result }>) {
  const pending = useNavigation().state !== "idle";
  // Only used to read what is typed, so the day it was when the page opened is good enough.
  const [today] = useState(berlinToday);

  // What the user just submitted wins over the saved draft.
  const initial = result?.values ?? draft?.values;
  const nextId = useRef(initial?.slots.length ?? 0);
  const [aktenzeichen, setAktenzeichen] = useState(initial?.aktenzeichen ?? "");
  const [rows, setRows] = useState<Row[]>(() => initialRows(initial?.slots));

  // Errors only appear for what the server flagged on submit, then clear live once fixed.
  const [flagged, setFlagged] = useState<Set<ErrorKey>>(
    () =>
      new Set(
        result
          ? (Object.keys(keyErrors(result.errors, initialRows(result.values.slots))) as ErrorKey[])
          : [],
      ),
  );
  const handledResult = useRef(result);
  useEffect(() => {
    if (!result || result === handledResult.current) return;
    handledResult.current = result;
    setFlagged(new Set(Object.keys(keyErrors(result.errors, rows)) as ErrorKey[]));
    const target = firstErrorTarget(result.errors);
    if (target) document.getElementById(target)?.focus();
  }, [result, rows]);

  const slots = useMemo(() => rows.map((row) => windowToSlot(row, today)), [rows, today]);
  const live = useMemo(() => {
    const validation = validateCreateTermin({ aktenzeichen, slots });
    return validation.success ? {} : keyErrors(validation.errors, rows);
  }, [aktenzeichen, slots, rows]);

  // An overlap is shown as soon as it exists, so adding dates tells right away what clashes.
  const shown: KeyedErrors = {};
  for (const key of Object.keys(live) as ErrorKey[]) {
    if (flagged.has(key) || key.endsWith(":overlap")) shown[key] = live[key];
  }

  const rowErrorsOf = (id: number) => {
    const errors: Partial<Record<SlotErrorGroup, string>> = {};
    for (const group of ["date", "start", "end", "range", "overlap"] as const) {
      const message = shown[`${id}:${group}`];
      if (message) errors[group] = message;
    }
    return errors;
  };

  const updateRow = (id: number, field: RowField, value: string) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  // A field is tidied when it loses focus. A window moves to its place only when focus leaves the
  // whole window, so it does not jump while it is edited.
  const leaveWindow = (event: FocusEvent<HTMLElement>, tidy?: { id: number; field: RowField }) => {
    const staysInWindow = event.currentTarget.closest("fieldset")?.contains(event.relatedTarget);
    setRows((current) => {
      const tidied = tidy
        ? current.map((row) => {
            if (row.id !== tidy.id) return row;
            const { field } = tidy;
            const value =
              field === "date" ? normalizeDate(row.date, today) : normalizeTime(row[field]);
            return { ...row, [field]: value };
          })
        : current;
      return staysInWindow ? tidied : sortWindows(tidied, today);
    });
  };
  const addRows = (windows: WindowText[]) =>
    setRows((current) =>
      sortWindows(
        [...current, ...windows.map((window) => ({ id: nextId.current++, ...window }))],
        today,
      ),
    );
  const removeRow = (id: number) => {
    const index = rows.findIndex((row) => row.id === id);
    const remaining = rows.length - 1;
    flushSync(() => setRows((current) => current.filter((row) => row.id !== id)));
    // The removed window had focus, so it moves to a neighbour or, if none is left, the add area.
    document
      .getElementById(remaining ? fieldId(Math.min(index, remaining - 1), "date") : ADD_DATE_ID)
      ?.focus();
  };

  return (
    <>
      <FlowPage width="narrow" spacing="form">
        <h1 className="kern-sr-only">Erstellen der Terminumfrage</h1>
        <Form method="post" className="create-termin__form" noValidate>
          {draft && <input type="hidden" name="appointmentId" value={draft.id} />}
          <section aria-labelledby="verhandlungsdaten" className="create-termin__section">
            <KernHeading size="large" level={2} id="verhandlungsdaten">
              Verhandlungsdaten
            </KernHeading>
            <KernFormInput
              id="aktenzeichen"
              label="Aktenzeichen"
              wrapperClassName="create-termin__aktenzeichen"
              error={shown.aktenzeichen}
              name="aktenzeichen"
              value={aktenzeichen}
              onChange={(event) => setAktenzeichen(event.target.value)}
              autoComplete="off"
            />
          </section>

          <section aria-labelledby="zeitfenster" className="create-termin__section">
            <KernHeading size="large" level={2} id="zeitfenster">
              Geben Sie Ihre verfügbaren Zeitfenster an
            </KernHeading>

            <fieldset
              aria-labelledby="zeitfenster"
              aria-describedby={shown.slots ? SLOTS_ERROR_ID : undefined}
              className={`create-termin__windows${shown.slots ? " kern-fieldset--error" : ""}`}
            >
              <AddWindows existing={rows} onAdd={addRows} />

              <div className="create-termin__list">
                <KernHeading size="medium" level={3} id="window-list-title">
                  {`Ihre Zeitfenster (${rows.length})`}
                </KernHeading>
                <p className="kern-hint">{`Mindestens ${MIN_SLOTS}, höchstens ${MAX_SLOTS} Zeitfenster.`}</p>

                {rows.length === 0 ? (
                  <p className="kern-body">Noch keine Zeitfenster hinzugefügt.</p>
                ) : (
                  <ul className="create-termin__rows" aria-labelledby="window-list-title">
                    {rows.map((row, index) => {
                      const rowErrors = rowErrorsOf(row.id);
                      const groups = Object.keys(rowErrors) as SlotErrorGroup[];
                      const iso = parseDate(row.date, today);
                      const input = (field: RowField, label: string, invalid: boolean) => (
                        <input
                          className={`kern-form-input__input create-termin__input create-termin__input--${field}${
                            invalid ? " kern-form-input__input--error" : ""
                          }`}
                          id={fieldId(index, field)}
                          aria-label={label}
                          aria-invalid={invalid || undefined}
                          inputMode={field === "date" ? undefined : "numeric"}
                          autoComplete="off"
                          value={row[field]}
                          onChange={(event) => updateRow(row.id, field, event.target.value)}
                          onBlur={(event) => leaveWindow(event, { id: row.id, field })}
                        />
                      );
                      return (
                        <li key={row.id}>
                          <fieldset
                            className={`create-termin__window${groups.length ? " kern-fieldset--error" : ""}`}
                            aria-describedby={
                              groups.map((group) => rowErrorId(row.id, group)).join(" ") ||
                              undefined
                            }
                          >
                            <legend className="kern-sr-only">{`Zeitfenster ${index + 1}`}</legend>
                            {slotFieldNames.map((name) => (
                              <input
                                type="hidden"
                                key={name}
                                name={`slots.${index}.${name}`}
                                value={slots[index]![name]}
                              />
                            ))}
                            <span className="create-termin__weekday">
                              {iso ? weekdayShort(iso) : ""}
                            </span>
                            {input("date", "Datum", Boolean(rowErrors.date))}
                            <div className="create-termin__range">
                              {input("start", "Beginn", Boolean(rowErrors.start))}
                              <span className="create-termin__dash" aria-hidden="true">
                                –
                              </span>
                              {input("end", "Ende", Boolean(rowErrors.end || rowErrors.range))}
                            </div>
                            <KernButton
                              type="button"
                              style="tertiary"
                              aria-label={`Zeitfenster ${index + 1} entfernen`}
                              onBlur={leaveWindow}
                              onClick={() => removeRow(row.id)}
                            >
                              <KernIcon name="delete" />
                            </KernButton>
                            {groups.length > 0 && (
                              <div className="create-termin__row-errors">
                                {groups.map((group) => (
                                  <ErrorMessage id={rowErrorId(row.id, group)} key={group}>
                                    {rowErrors[group]}
                                  </ErrorMessage>
                                ))}
                              </div>
                            )}
                          </fieldset>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {shown.slots && <ErrorMessage id={SLOTS_ERROR_ID}>{shown.slots}</ErrorMessage>}
              </div>
            </fieldset>
          </section>

          <div className="create-termin__actions">
            <KernLinkButton style="secondary" to="/overview">
              <KernLabel>Abbrechen</KernLabel>
            </KernLinkButton>
            <KernButton type="submit" disabled={pending}>
              Weiter
            </KernButton>
          </div>
        </Form>
      </FlowPage>
    </>
  );
}
