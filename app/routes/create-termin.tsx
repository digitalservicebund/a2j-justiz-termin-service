import { Fragment, useEffect, useRef, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { requireRole } from "~/adapters/session/session";
import Alert from "~/components/shared/Alert";
import { AppShell } from "~/components/shared/AppShell";
import { Button } from "~/components/shared/Button";
import { Icon } from "~/components/shared/Icon";

import {
  emptySlot,
  parseCreateTerminForm,
  validateCreateTermin,
  type CreateTerminErrors,
  type SlotErrorGroup,
  type SlotField,
  type SlotInput,
} from "./create-termin.schema";

import "./create-termin.css";

const INITIAL_ROWS = 3;

export async function loader({ request }: { request: Request }) {
  return { user: await requireRole(request, "richter") };
}

export async function action({ request }: { request: Request }) {
  await requireRole(request, "richter");
  const values = parseCreateTerminForm(await request.formData());
  const result = validateCreateTermin(values);
  if (!result.success) {
    return data({ values, errors: result.errors }, { status: 400 });
  }
  // The next step of the flow is not designed yet and nothing is persisted.
  return redirect("/overview");
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
};

const fieldId = (index: number, field: SlotField) => `slots-${index}-${field}`;

function initialRows(values?: SlotInput[]): Row[] {
  const slots = values?.length
    ? values
    : Array.from({ length: INITIAL_ROWS }, () => ({ ...emptySlot }));
  return slots.map((slot, id) => ({ id, slot }));
}

type SummaryItem = { href: string; message: string };

function summaryItems(errors: CreateTerminErrors): SummaryItem[] {
  const items: SummaryItem[] = [];
  if (errors.aktenzeichen) items.push({ href: "#aktenzeichen", message: errors.aktenzeichen });
  if (errors.slots) items.push({ href: `#${fieldId(0, "day")}`, message: errors.slots });
  for (const [index, groups] of Object.entries(errors.rows)) {
    for (const [group, message] of Object.entries(groups)) {
      const target = fieldId(Number(index), firstFieldOfGroup[group as SlotErrorGroup]);
      items.push({ href: `#${target}`, message: `Zeitfenster ${Number(index) + 1}: ${message}` });
    }
  }
  return items;
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
  return fields.map(({ field, label, maxLength }, position) => (
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
          errors[groupOfField[field]] || (errors.range && groupOfField[field] === "end")
            ? " kern-form-input__input--error"
            : ""
        }`}
        id={fieldId(index, field)}
        name={`slots.${index}.${field}`}
        aria-label={label}
        aria-invalid={Boolean(errors[groupOfField[field]]) || undefined}
        inputMode="numeric"
        autoComplete="off"
        maxLength={maxLength}
        value={slot[field]}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </Fragment>
  ));
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
      <span
        className={`kern-label kern-label--small kern-label--subtle create-termin__caption create-termin__caption--${maxLength}`}
      >
        {label}
      </span>
    </Fragment>
  ));
}

export default function CreateTermin() {
  const { user } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  const nextId = useRef(INITIAL_ROWS);
  const [rows, setRows] = useState<Row[]>(() => initialRows(result?.values.slots));
  const errors = result?.errors;
  const items = errors ? summaryItems(errors) : [];

  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors) summary.current?.focus();
  }, [errors]);

  const updateSlot = (id: number, field: SlotField, value: string) =>
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, slot: { ...row.slot, [field]: value } } : row,
      ),
    );
  const addRow = () =>
    setRows((current) => [...current, { id: nextId.current++, slot: { ...emptySlot } }]);
  const removeRow = (id: number) => setRows((current) => current.filter((row) => row.id !== id));

  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Startseite", href: "/", icon: "home" },
        { label: "Verhandlungstermin-Finder", href: "/home" },
        { label: "Erstellen der Terminumfrage" },
      ]}
    >
      <div className="create-termin">
        <div className="page-shell__content">
          <h1 className="kern-sr-only">Erstellen der Terminumfrage</h1>
          <Form method="post" className="create-termin__form" noValidate>
            {items.length > 0 && (
              <div ref={summary} tabIndex={-1} className="create-termin__summary">
                <Alert type="error" title="Bitte prüfen Sie Ihre Angaben">
                  <ul className="kern-list">
                    {items.map(({ href, message }) => (
                      <li key={`${href}-${message}`}>
                        <a className="kern-link" href={href}>
                          {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}

            <section aria-labelledby="verhandlungsdaten" className="create-termin__section">
              <h2 className="kern-heading-large" id="verhandlungsdaten">
                Verhandlungsdaten
              </h2>
              <div
                className={`kern-form-input create-termin__aktenzeichen${
                  errors?.aktenzeichen ? " kern-form-input--error" : ""
                }`}
              >
                <label className="kern-label" htmlFor="aktenzeichen">
                  Aktenzeichen
                </label>
                <input
                  className={`kern-form-input__input${
                    errors?.aktenzeichen ? " kern-form-input__input--error" : ""
                  }`}
                  id="aktenzeichen"
                  name="aktenzeichen"
                  defaultValue={result?.values.aktenzeichen}
                  aria-invalid={Boolean(errors?.aktenzeichen) || undefined}
                  aria-describedby={errors?.aktenzeichen ? "aktenzeichen-error" : undefined}
                  autoComplete="off"
                />
                {errors?.aktenzeichen && (
                  <span className="kern-error" id="aktenzeichen-error">
                    {errors.aktenzeichen}
                  </span>
                )}
              </div>
            </section>

            <section aria-labelledby="zeitfenster" className="create-termin__section">
              <h2 className="kern-heading-large" id="zeitfenster">
                Geben Sie Ihre verfügbaren Zeitfenster an
              </h2>

              <div className="create-termin__rows">
                <div className="create-termin__row create-termin__row--head" aria-hidden="true">
                  <div className="create-termin__head">
                    <span className="kern-label">Datum</span>
                    <div className="create-termin__group create-termin__group--date">
                      <Captions fields={dateFields} />
                    </div>
                  </div>
                  <div className="create-termin__range">
                    <div className="create-termin__head">
                      <span className="kern-label">Startzeit</span>
                      <div className="create-termin__group create-termin__group--time">
                        <Captions fields={startFields} />
                      </div>
                    </div>
                    <span className="create-termin__dash">–</span>
                    <div className="create-termin__head">
                      <span className="kern-label">Endzeit</span>
                      <div className="create-termin__group create-termin__group--time">
                        <Captions fields={endFields} />
                      </div>
                    </div>
                  </div>
                </div>

                {rows.map(({ id, slot }, index) => {
                  const rowErrors = errors?.rows[index] ?? {};
                  const onChange = (field: SlotField, value: string) =>
                    updateSlot(id, field, value);
                  return (
                    <fieldset className="create-termin__row" key={id}>
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
                        {rows.length > 1 && (
                          <Button
                            type="button"
                            style="tertiary"
                            aria-label={`Zeitfenster ${index + 1} entfernen`}
                            onClick={() => removeRow(id)}
                          >
                            <Icon name="delete" />
                          </Button>
                        )}
                      </div>
                      {Object.keys(rowErrors).length > 0 && (
                        <ul className="create-termin__row-errors">
                          {Object.entries(rowErrors).map(([group, message]) => (
                            <li className="kern-error" key={group}>
                              {message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </fieldset>
                  );
                })}
              </div>

              <Button
                type="button"
                style="secondary"
                className="create-termin__add"
                onClick={addRow}
              >
                <Icon name="add" />
                <span className="kern-label">Zeitfenster hinzufügen</span>
              </Button>
            </section>

            <div className="create-termin__actions">
              <Link className="kern-btn kern-btn--secondary" to="/overview">
                <span className="kern-label">Abbrechen</span>
              </Link>
              <Button type="submit" disabled={pending}>
                Weiter
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </AppShell>
  );
}
