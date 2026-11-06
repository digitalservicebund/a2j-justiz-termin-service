import { Fragment } from "react";
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  addDraftSlot,
  getAppointment,
  updateDraftSlot,
} from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { clusterClassName, stackClassName } from "~/components/shared/kern/layout";
import { getDb } from "~/database/database";

import { draftHref, NEW_SLOT } from "./create-termin.paths";
import { createTerminBreadcrumbs } from "./create-termin.review";
import {
  emptySlot,
  MAX_SLOTS,
  messages,
  parseSlotForm,
  validateSlot,
  type SlotErrorGroup,
  type SlotErrors,
  type SlotField,
  type SlotInput,
} from "./create-termin.schema";
import { rangeToSlot, slotToRange } from "./create-termin.slots";

import "./create-termin.css";
import "./create-termin.slot.css";

type Params = { params: { appointmentId?: string; slotId?: string } };

const notFound = () => data("Not found", { status: 404 });

// Only a draft can be changed. The slot is a draft exactly when its appointment is.
async function loadDraft(request: Request, { params }: Params) {
  const user = await requireRole(request, "richter");
  const appointment = await getAppointment(getDb(), user.id, params.appointmentId ?? "");
  if (!appointment) throw notFound();
  if (appointment.status !== "draft") throw redirect("/overview");
  return { user, appointment };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { user, appointment } = await loadDraft(request, { params });
  const isNew = params.slotId === NEW_SLOT;
  // A copy starts from the values of the slot it copies; an edit from the slot itself.
  const sourceId = isNew ? new URL(request.url).searchParams.get("kopie") : params.slotId;
  const source = appointment.slots.find((slot) => slot.id === sourceId);
  if (!isNew && !source) throw notFound();

  return {
    user,
    isNew,
    cancelHref: draftHref(appointment.id),
    values: source ? rangeToSlot(source) : emptySlot,
  };
}

type ActionResult = { values: SlotInput; errors: SlotErrors };

export async function action({ request, params }: { request: Request } & Params) {
  const { user, appointment } = await loadDraft(request, { params });
  const db = getDb();
  const isNew = params.slotId === NEW_SLOT;
  const values = parseSlotForm(await request.formData());
  const reject = (errors: SlotErrors) =>
    data({ values, errors } satisfies ActionResult, { status: 400 });

  if (!isNew && !appointment.slots.some((slot) => slot.id === params.slotId)) throw notFound();
  if (isNew && appointment.slots.length >= MAX_SLOTS) {
    return reject({ overlap: messages.tooManySlots });
  }

  const others = appointment.slots.filter((slot) => slot.id !== params.slotId).map(rangeToSlot);
  const result = validateSlot(values, others);
  if (!result.success) return reject(result.errors);

  const range = slotToRange(values);
  const saved = isNew
    ? await addDraftSlot(db, user.id, appointment.id, range)
    : await updateDraftSlot(db, user.id, appointment.id, params.slotId ?? "", range);
  if (!saved) throw notFound();
  return redirect(draftHref(appointment.id));
}

// KERN only offers input width modifiers for 2 and 4 characters, which is all we need.
type FieldConfig = { field: SlotField; label: string; maxLength: 2 | 4; group: SlotErrorGroup };

const dateFields: FieldConfig[] = [
  { field: "day", label: "Tag", maxLength: 2, group: "date" },
  { field: "month", label: "Monat", maxLength: 2, group: "date" },
  { field: "year", label: "Jahr", maxLength: 4, group: "date" },
];
const startFields: FieldConfig[] = [
  { field: "startHour", label: "Stunde", maxLength: 2, group: "start" },
  { field: "startMinute", label: "Minute", maxLength: 2, group: "start" },
];
const endFields: FieldConfig[] = [
  { field: "endHour", label: "Stunde", maxLength: 2, group: "end" },
  { field: "endMinute", label: "Minute", maxLength: 2, group: "end" },
];

const colonLayout = clusterClassName({ wrap: false, align: "center" });

const errorId = (group: SlotErrorGroup) => `slot-${group}-error`;

export default function CreateTerminSlot() {
  const { user, isNew, cancelHref, values: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  // What the user just submitted wins over the saved slot.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};
  const groups = (["date", "start", "end", "range", "overlap"] as const).filter(
    (group) => errors[group],
  );

  const fieldset = (legend: string, group: SlotErrorGroup, fields: FieldConfig[], dots = false) => {
    const flagged = Boolean(errors[group] || errors.overlap || (group === "end" && errors.range));
    const described = [group, ...(group === "end" ? ["range" as const] : []), "overlap" as const]
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
        {fields.map(({ field, label, maxLength }, position) => (
          <Fragment key={field}>
            {position > 0 && (
              <span
                className={`create-termin-slot__separator${dots ? "" : ` create-termin-slot__separator--colon ${colonLayout}`}`}
                aria-hidden="true"
              >
                {dots ? "." : ":"}
              </span>
            )}
            <KernFormInput
              id={field}
              name={field}
              label={label}
              compactLabel
              width={maxLength}
              invalid={flagged}
              inputMode="numeric"
              autoComplete="off"
              maxLength={maxLength}
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
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <Form method="post" className={stackClassName({ gap: "xl" }, "form")} noValidate>
          <KernStack gap="sm">
            <KernBody size="small" bold>
              Zeitfenster
            </KernBody>
            <KernHeading size="large" level={1}>
              {isNew
                ? "Geben Sie Ihr verfügbares Zeitfenster an"
                : "Ändern Sie Ihr verfügbares Zeitfenster"}
            </KernHeading>
          </KernStack>

          <KernCluster gap="md" align="end" className="create-termin-slot__fields">
            {fieldset("Datum", "date", dateFields, true)}
            <span className="kern-body create-termin-slot__word">von</span>
            {fieldset("Beginn", "start", startFields)}
            <span className="kern-body create-termin-slot__word">bis</span>
            {fieldset("Ende", "end", endFields)}
          </KernCluster>

          {groups.length > 0 && (
            <KernStack gap="sm">
              {groups.map((group) => (
                <ErrorMessage id={errorId(group)} key={group}>
                  {errors[group]}
                </ErrorMessage>
              ))}
            </KernStack>
          )}

          <KernCluster gap="md" className="kern-pt-md">
            <KernLinkButton style="secondary" to={cancelHref}>
              <KernLabel>Abbrechen</KernLabel>
            </KernLinkButton>
            <KernButton type="submit" disabled={pending}>
              Speichern
            </KernButton>
          </KernCluster>
        </Form>
      </FlowPage>
    </AppShell>
  );
}
