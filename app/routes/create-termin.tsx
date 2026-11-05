import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  createDraftAppointment,
  deleteDraftIfEmpty,
  deleteDraftSlot,
  getAppointment,
  updateDraftAktenzeichen,
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
import {
  KernCell,
  KernColumn,
  KernRow,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { getDb } from "~/database/database";

import { draftHref, NEW_SLOT, slotHref } from "./create-termin.paths";
import { createTerminBreadcrumbs } from "./create-termin.review";
import {
  aktenzeichenProblem,
  MAX_SLOTS,
  validateCreateTermin,
  type CreateTerminErrors,
} from "./create-termin.schema";
import { describeSlot, rangeToSlot } from "./create-termin.slots";

import "./create-termin.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const draftId = new URL(request.url).searchParams.get("entwurf");
  if (!draftId) return { user, draft: null };

  // The draft is the only place the entered data lives, so every visit reads it from there.
  const appointment = await getAppointment(getDb(), user.id, draftId);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status !== "draft") throw redirect("/overview");
  return {
    user,
    draft: {
      id: appointment.id,
      aktenzeichen: appointment.aktenzeichen,
      slots: appointment.slots.map((slot) => ({
        id: slot.id,
        ...describeSlot(slot),
        // Lets the server say which row a problem belongs to.
        input: rangeToSlot(slot),
      })),
    },
  };
}

type ActionResult = {
  aktenzeichen: string;
  errors: { aktenzeichen?: string; slots?: string; rows: CreateTerminErrors["rows"] };
};

// Every button of the form submits the Aktenzeichen with it, so nothing typed is lost on the way
// to another page. The intent says what the user asked for; slot buttons carry the slot's id.
export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const db = getDb();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const [command = "", slotId = ""] = intent.split(":");
  const aktenzeichen = String(formData.get("aktenzeichen") ?? "");
  const draftIdValue = formData.get("appointmentId");
  const draftId = typeof draftIdValue === "string" ? draftIdValue : "";

  if (command === "cancel") {
    if (draftId) await deleteDraftIfEmpty(db, user.id, draftId);
    return redirect("/overview");
  }

  const final = command === "next";
  const problem = aktenzeichenProblem(aktenzeichen, { required: final });
  const rejected = (errors: Partial<ActionResult["errors"]>) =>
    data({ aktenzeichen, errors: { rows: {}, ...errors } } satisfies ActionResult, {
      status: 400,
    });
  if (problem) return rejected({ aktenzeichen: problem });

  let id = draftId;
  if (id) {
    if (!(await updateDraftAktenzeichen(db, user.id, id, aktenzeichen.trim()))) {
      throw data("Not found", { status: 404 });
    }
  } else if (final) {
    // Nothing was entered, so there is no draft; the checks below report what is missing.
  } else {
    id = await createDraftAppointment(db, user.id, aktenzeichen.trim());
  }

  switch (command) {
    case "add-slot":
      return redirect(slotHref(id, NEW_SLOT));
    case "edit-slot":
      return redirect(slotHref(id, slotId));
    case "copy-slot":
      return redirect(slotHref(id, NEW_SLOT, slotId));
    case "delete-slot":
      if (!(await deleteDraftSlot(db, user.id, id, slotId)))
        throw data("Not found", { status: 404 });
      return redirect(draftHref(id));
    case "next": {
      const appointment = id ? await getAppointment(db, user.id, id) : undefined;
      const result = validateCreateTermin({
        aktenzeichen,
        slots: appointment?.slots.map(rangeToSlot) ?? [],
      });
      if (!result.success) {
        const { errors } = result;
        return data({ aktenzeichen, errors } satisfies ActionResult, { status: 400 });
      }
      return redirect(`/overview/${encodeURIComponent(id)}/confirm`);
    }
    default:
      throw data("Bad request", { status: 400 });
  }
}

export default function CreateTermin() {
  const { user, draft } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  // What the user just submitted wins over the saved draft.
  const aktenzeichen = result?.aktenzeichen ?? draft?.aktenzeichen ?? "";
  const errors = result?.errors;
  const slots = draft?.slots ?? [];
  const atLimit = slots.length >= MAX_SLOTS;
  const rowErrors = (index: number) => Object.values(errors?.rows[index] ?? {});

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <h1 className="kern-sr-only">Erstellen der Terminumfrage</h1>
        <Form method="post" className="create-termin__form" noValidate>
          {/* Pressing Enter in a field submits the first button, which has to be "Weiter". */}
          <button type="submit" name="intent" value="next" hidden tabIndex={-1} />
          {draft && <input type="hidden" name="appointmentId" value={draft.id} />}
          <section aria-labelledby="verhandlungsdaten" className="create-termin__section">
            <KernHeading size="large" level={2} id="verhandlungsdaten">
              Verhandlungsdaten
            </KernHeading>
            <KernFormInput
              id="aktenzeichen"
              label="Aktenzeichen"
              wrapperClassName="create-termin__aktenzeichen"
              error={errors?.aktenzeichen}
              name="aktenzeichen"
              defaultValue={aktenzeichen}
              // Remounts when a rejected submit brings back what was typed.
              key={aktenzeichen}
              autoComplete="off"
            />
          </section>

          <section aria-labelledby="zeitfenster" className="create-termin__section">
            <KernHeading size="large" level={2} id="zeitfenster">
              Geben Sie Ihre verfügbaren Zeitfenster an
            </KernHeading>

            <div
              className={`create-termin__windows${errors?.slots ? " kern-fieldset--error" : ""}`}
            >
              {slots.length > 0 && (
                <KernTable
                  caption="Zeitfenster"
                  hideCaption
                  striped
                  className="create-termin__table"
                >
                  <KernTableHead>
                    <KernRow>
                      <KernColumn>Datum</KernColumn>
                      <KernColumn>Uhrzeit</KernColumn>
                      <KernColumn variant="action">Aktionen</KernColumn>
                    </KernRow>
                  </KernTableHead>
                  <KernTableBody>
                    {slots.map(({ id, date, time }, index) => {
                      const label = `${date}, ${time}`;
                      const problems = rowErrors(index);
                      return (
                        <KernRow key={id}>
                          <KernCell>{date}</KernCell>
                          <KernCell>
                            {time}
                            {problems.map((message, position) => (
                              <ErrorMessage id={`slot-${id}-error-${position}`} key={message}>
                                {message}
                              </ErrorMessage>
                            ))}
                          </KernCell>
                          <KernCell variant="action">
                            <div className="create-termin__actions-cell">
                              <SlotButton
                                intent={`edit-slot:${id}`}
                                icon="edit"
                                label={`Zeitfenster ${label} bearbeiten`}
                              />
                              <SlotButton
                                intent={`copy-slot:${id}`}
                                icon="content-copy"
                                label={`Zeitfenster ${label} kopieren`}
                              />
                              <SlotButton
                                intent={`delete-slot:${id}`}
                                icon="delete"
                                label={`Zeitfenster ${label} löschen`}
                              />
                            </div>
                          </KernCell>
                        </KernRow>
                      );
                    })}
                  </KernTableBody>
                </KernTable>
              )}

              <KernButton
                type="submit"
                name="intent"
                value="add-slot"
                style="secondary"
                className="create-termin__add"
                disabled={atLimit}
                aria-describedby={atLimit ? "add-hint" : undefined}
              >
                <KernIcon name="add" />
                <KernLabel>Zeitfenster hinzufügen</KernLabel>
              </KernButton>
              {atLimit && (
                <p className="kern-hint" id="add-hint">
                  {`Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`}
                </p>
              )}
              {errors?.slots && <ErrorMessage id="slots-error">{errors.slots}</ErrorMessage>}
            </div>
          </section>

          <div className="create-termin__actions">
            <KernButton type="submit" name="intent" value="cancel" style="secondary">
              <KernLabel>Abbrechen</KernLabel>
            </KernButton>
            <KernButton type="submit" name="intent" value="next" disabled={pending}>
              Weiter
            </KernButton>
          </div>
        </Form>
      </FlowPage>
    </AppShell>
  );
}

function SlotButton({
  intent,
  icon,
  label,
}: Readonly<{ intent: string; icon: "edit" | "content-copy" | "delete"; label: string }>) {
  return (
    <KernButton type="submit" name="intent" value={intent} style="tertiary" aria-label={label}>
      <KernIcon name={icon} />
    </KernButton>
  );
}
