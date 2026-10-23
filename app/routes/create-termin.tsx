import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

import { createTerminBreadcrumbs } from "./create-termin.review";
import {
  emptySlot,
  isEmptySlot,
  MAX_SLOTS,
  messages,
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

const INITIAL_ROWS = 3;

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

type Row = { id: number; slot: SlotInput };

// KERN only offers input width modifiers for 2 and 4 characters, which is all we need.
type FieldConfig = { field: SlotField; label: string; maxLength: 2 | 4 };

const dateFields: FieldConfig[] = [
  { field: "day", label: "Tag", maxLength: 2 },
  { field: "month", label: "Monat", maxLength: 2 },
  { field: "year", label: "Jahr", maxLength: 4 },
];

const startFields: FieldConfig[] = [
  { field: "startHour", label: "Stunde", maxLength: 2 },
  { field: "startMinute", label: "Minute", maxLength: 2 },
];

const endFields: FieldConfig[] = [
  { field: "endHour", label: "Stunde", maxLength: 2 },
  { field: "endMinute", label: "Minute", maxLength: 2 },
];

const separatorFor = (field: SlotField) =>
  field === "startMinute" || field === "endMinute" ? ":" : ".";

const groupOfField: Record<SlotField, SlotErrorGroup> = {
  day: "date",
  month: "date",
  year: "date",
  startHour: "start",
  startMinute: "start",
  endHour: "end",
  endMinute: "end",
};

const firstFieldOfGroup: Record<SlotErrorGroup, SlotField> = {
  date: "day",
  start: "startHour",
  end: "endHour",
  range: "endHour",
  overlap: "day",
};

const fieldId = (index: number, field: SlotField) => `slots-${index}-${field}`;
const ADD_BUTTON_ID = "add-zeitfenster";
const SLOTS_ERROR_ID = "slots-error";
const rowErrorId = (id: number, group: SlotErrorGroup) => `row-${id}-${group}-error`;

function initialRows(values?: SlotInput[]): Row[] {
  const slots = values?.length
    ? values
    : Array.from({ length: INITIAL_ROWS }, () => ({ ...emptySlot }));
  return slots.map((slot, id) => ({ id, slot }));
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
    return fieldId(index, firstFieldOfGroup[group!]);
  }
  return errors.slots ? ADD_BUTTON_ID : null;
}

function SegmentedFields({
  fields,
  index,
  slot,
  errors,
  onChange,
}: Readonly<{
  fields: FieldConfig[];
  index: number;
  slot: SlotInput;
  errors: Partial<Record<SlotErrorGroup, string>>;
  onChange: (field: SlotField, value: string) => void;
}>) {
  return fields.map(({ field, label, maxLength }, position) => {
    const group = groupOfField[field];
    const invalid = Boolean(errors[group] || (group === "end" && errors.range));
    return (
      <Fragment key={field}>
        {position > 0 && (
          <span
            className={`create-termin__separator create-termin__separator--${separatorFor(field) === "." ? "dot" : "colon"}`}
            aria-hidden="true"
          >
            {separatorFor(field)}
          </span>
        )}
        <input
          className={`kern-form-input__input kern-form-input__input--width-${maxLength}${
            invalid ? " kern-form-input__input--error" : ""
          }`}
          id={fieldId(index, field)}
          name={`slots.${index}.${field}`}
          aria-label={label}
          aria-invalid={invalid || undefined}
          inputMode="numeric"
          autoComplete="off"
          maxLength={maxLength}
          value={slot[field]}
          onChange={(event) => onChange(field, event.target.value)}
        />
      </Fragment>
    );
  });
}

// Column captions reuse the input layout, with invisible separators, so they stay aligned.
function Captions({ fields }: Readonly<{ fields: FieldConfig[] }>) {
  return fields.map(({ field, label, maxLength }, position) => (
    <Fragment key={field}>
      {position > 0 && (
        <span className="create-termin__separator" aria-hidden="true">
          {separatorFor(field)}
        </span>
      )}
      <KernLabel
        size="small"
        subtle
        className={`create-termin__caption create-termin__caption--${maxLength}`}
      >
        {label}
      </KernLabel>
    </Fragment>
  ));
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

  // What the user just submitted wins over the saved draft.
  const initial = result?.values ?? draft?.values;
  const nextId = useRef(Math.max(INITIAL_ROWS, initial?.slots.length ?? 0));
  const [aktenzeichen, setAktenzeichen] = useState(initial?.aktenzeichen ?? "");
  const [rows, setRows] = useState<Row[]>(() => initialRows(initial?.slots));
  // Set when the user tries to remove a row while only the minimum number is left.
  const [removeBlocked, setRemoveBlocked] = useState(false);

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

  const live = useMemo(() => {
    const validation = validateCreateTermin({ aktenzeichen, slots: rows.map((row) => row.slot) });
    return validation.success ? {} : keyErrors(validation.errors, rows);
  }, [aktenzeichen, rows]);

  const shown: KeyedErrors = {};
  for (const key of flagged) {
    if (live[key]) shown[key] = live[key];
  }
  if (removeBlocked) shown.slots = messages.tooFewSlots;

  const rowErrorsOf = (id: number) => {
    const errors: Partial<Record<SlotErrorGroup, string>> = {};
    for (const group of ["date", "start", "end", "range", "overlap"] as const) {
      const message = shown[`${id}:${group}`];
      if (message) errors[group] = message;
    }
    return errors;
  };

  const updateSlot = (id: number, field: SlotField, value: string) => {
    setRemoveBlocked(false);
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, slot: { ...row.slot, [field]: value } } : row,
      ),
    );
  };
  const addRow = () => {
    setRemoveBlocked(false);
    setRows((current) => [...current, { id: nextId.current++, slot: { ...emptySlot } }]);
  };
  const removeRow = (id: number) => {
    if (rows.length <= MIN_SLOTS) {
      setRemoveBlocked(true);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const atLimit = rows.length >= MAX_SLOTS;

  return (
    <>
      <FlowPage className="create-termin">
        <div className="page-shell__content">
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
                <div className="create-termin__rows">
                  <div className="create-termin__row create-termin__row--head" aria-hidden="true">
                    <div className="create-termin__head">
                      <KernLabel>Datum</KernLabel>
                      <div className="create-termin__group create-termin__group--date">
                        <Captions fields={dateFields} />
                      </div>
                    </div>
                    <div className="create-termin__range">
                      <div className="create-termin__head">
                        <KernLabel>Startzeit</KernLabel>
                        <div className="create-termin__group create-termin__group--time">
                          <Captions fields={startFields} />
                        </div>
                      </div>
                      <span className="create-termin__dash">–</span>
                      <div className="create-termin__head">
                        <KernLabel>Endzeit</KernLabel>
                        <div className="create-termin__group create-termin__group--time">
                          <Captions fields={endFields} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {rows.map(({ id, slot }, index) => {
                    const rowErrors = rowErrorsOf(id);
                    const groups = Object.keys(rowErrors) as SlotErrorGroup[];
                    const onChange = (field: SlotField, value: string) =>
                      updateSlot(id, field, value);
                    return (
                      <fieldset
                        className={`create-termin__row${groups.length ? " kern-fieldset--error" : ""}`}
                        aria-describedby={
                          groups.map((group) => rowErrorId(id, group)).join(" ") || undefined
                        }
                        key={id}
                      >
                        <legend className="kern-sr-only">{`Zeitfenster ${index + 1}`}</legend>
                        <div className="create-termin__group create-termin__group--date">
                          <SegmentedFields
                            fields={dateFields}
                            index={index}
                            slot={slot}
                            errors={rowErrors}
                            onChange={onChange}
                          />
                        </div>
                        <div className="create-termin__range">
                          <div className="create-termin__group create-termin__group--time">
                            <SegmentedFields
                              fields={startFields}
                              index={index}
                              slot={slot}
                              errors={rowErrors}
                              onChange={onChange}
                            />
                          </div>
                          <span className="create-termin__dash" aria-hidden="true">
                            –
                          </span>
                          <div className="create-termin__group create-termin__group--time">
                            <SegmentedFields
                              fields={endFields}
                              index={index}
                              slot={slot}
                              errors={rowErrors}
                              onChange={onChange}
                            />
                          </div>
                          <KernButton
                            type="button"
                            style="tertiary"
                            aria-label={`Zeitfenster ${index + 1} entfernen`}
                            onClick={() => removeRow(id)}
                          >
                            <KernIcon name="delete" />
                          </KernButton>
                        </div>
                        {groups.length > 0 && (
                          <div className="create-termin__row-errors">
                            {groups.map((group) => (
                              <ErrorMessage id={rowErrorId(id, group)} key={group}>
                                {rowErrors[group]}
                              </ErrorMessage>
                            ))}
                          </div>
                        )}
                      </fieldset>
                    );
                  })}
                </div>

                <KernButton
                  id={ADD_BUTTON_ID}
                  type="button"
                  style="secondary"
                  className="create-termin__add"
                  disabled={atLimit}
                  aria-describedby={atLimit ? "add-hint" : undefined}
                  onClick={addRow}
                >
                  <KernIcon name="add" />
                  <KernLabel>Zeitfenster hinzufügen</KernLabel>
                </KernButton>
                {atLimit && (
                  <p className="kern-hint" id="add-hint">
                    {`Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`}
                  </p>
                )}
                {shown.slots && <ErrorMessage id={SLOTS_ERROR_ID}>{shown.slots}</ErrorMessage>}
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
        </div>
      </FlowPage>
    </>
  );
}
