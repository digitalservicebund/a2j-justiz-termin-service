import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  createDraftAppointment,
  deleteDraftIfEmpty,
  deleteDraftSlot,
  getAppointment,
  updateDraftAktenzeichen,
} from "~/adapters/appointments/appointments.server";
import {
  deleteDraftParticipant,
  listParticipants,
} from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { FieldColumn, FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernStack } from "~/components/shared/kern/KernStack";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { classNames } from "~/components/shared/kern/layout";
import { getDb } from "~/database/database";

import { MAX_PARTICIPANTS } from "./create-termin.participant.schema";
import { draftHref, NEW_SLOT, participantHref, slotHref } from "./create-termin.paths";
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
  const db = getDb();
  const appointment = await getAppointment(db, user.id, draftId);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status !== "draft") throw redirect("/overview");
  return {
    user,
    draft: {
      id: appointment.id,
      aktenzeichen: appointment.aktenzeichen,
      participants: await listParticipants(db, user.id, appointment.id),
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
// to another page. The intent says what the user asked for; the buttons of a row carry its id.
export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const db = getDb();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const [command = "", rowId = ""] = intent.split(":");
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
      return redirect(slotHref(id, rowId));
    case "copy-slot":
      return redirect(slotHref(id, NEW_SLOT, rowId));
    case "delete-slot":
      if (!(await deleteDraftSlot(db, user.id, id, rowId)))
        throw data("Not found", { status: 404 });
      return redirect(draftHref(id));
    case "add-person":
      return redirect(participantHref(id, NEW_SLOT));
    case "edit-person":
      return redirect(participantHref(id, rowId));
    case "delete-person":
      if (!(await deleteDraftParticipant(db, user.id, id, rowId))) {
        throw data("Not found", { status: 404 });
      }
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
  const participants = draft?.participants ?? [];
  const rowErrors = (index: number) => Object.values(errors?.rows[index] ?? {});

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <FormStack method="post" noValidate>
          {/* Pressing Enter in a field submits the first button, which has to be "Weiter". */}
          <button type="submit" name="intent" value="next" hidden tabIndex={-1} />
          {draft && <input type="hidden" name="appointmentId" value={draft.id} />}
          <KernStack as="section" gap="md" aria-labelledby="verhandlungsdaten">
            <KernHeading size="large" level={1} id="verhandlungsdaten">
              Geben Sie die Verhandlungsdaten an
            </KernHeading>
            <FieldColumn size="small">
              <KernFormInput
                id="aktenzeichen"
                label="Aktenzeichen"
                error={errors?.aktenzeichen}
                name="aktenzeichen"
                defaultValue={aktenzeichen}
                // Remounts when a rejected submit brings back what was typed.
                key={aktenzeichen}
                autoComplete="off"
              />
            </FieldColumn>
          </KernStack>

          <KernStack as="section" gap="md" aria-labelledby="verfahrensbeteiligte">
            <KernStack gap="xs">
              <KernHeading className="kern-m-none" size="medium" level={2} id="verfahrensbeteiligte">
                Geben Sie alle Verfahrensbeteiligten an
              </KernHeading>
              <KernBody className="kern-m-none">
                Personen ohne E-Mail-Adresse können Sie später mit einem Link zur Terminumfrage
                einladen.
              </KernBody>
            </KernStack>
            <KernStack gap="md" align="start" className="create-termin__windows">
              <KernTable
                caption="Verfahrensbeteiligte"
                hideCaption
                striped={participants.length > 0}
                className="create-termin__table kern-w-full"
              >
                <KernTableHead>
                  <KernRow>
                    <KernColumn>E-Mail-Adresse</KernColumn>
                    <KernColumn>Name</KernColumn>
                    <KernColumn variant="action">Aktionen</KernColumn>
                  </KernRow>
                </KernTableHead>
                <KernTableBody>
                  {participants.length === 0 ? (
                    <EmptyRow>Sie haben keine Verfahrensbeteiligten angegeben.</EmptyRow>
                  ) : (
                    participants.map(({ id, email, name }) => {
                      const label = `Person ${email ?? name}`;
                      return (
                        <KernRow key={id}>
                          <KernCell>{email}</KernCell>
                          <KernCell>{name}</KernCell>
                          <KernCell variant="action">
                            <KernCluster wrap={false} gap="sm" justify="center">
                              <RowButton
                                intent={`edit-person:${id}`}
                                icon="edit"
                                label={`${label} bearbeiten`}
                              />
                              <RowButton
                                intent={`delete-person:${id}`}
                                icon="delete"
                                label={`${label} löschen`}
                              />
                            </KernCluster>
                          </KernCell>
                        </KernRow>
                      );
                    })
                  )}
                </KernTableBody>
              </KernTable>
              <AddButton
                intent="add-person"
                label="Person hinzufügen"
                limit={participants.length >= MAX_PARTICIPANTS}
                hint={`Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`}
                hintId="add-person-hint"
              />
            </KernStack>
          </KernStack>

          <KernStack as="section" gap="md" aria-labelledby="zeitfenster">
            <KernHeading size="medium" level={2} id="zeitfenster">
              Zeitfenster
            </KernHeading>

            <KernStack
              gap="md"
              align="start"
              className={classNames("create-termin__windows", errors?.slots && "kern-fieldset--error")}
            >
              <KernTable
                caption="Zeitfenster"
                hideCaption
                striped={slots.length > 0}
                className="create-termin__table kern-w-full"
              >
                <KernTableHead>
                  <KernRow>
                    <KernColumn>Datum</KernColumn>
                    <KernColumn>Uhrzeit</KernColumn>
                    <KernColumn variant="action">Aktionen</KernColumn>
                  </KernRow>
                </KernTableHead>
                <KernTableBody>
                  {slots.length === 0 ? (
                    <EmptyRow>Sie haben keine Zeitfenster angegeben.</EmptyRow>
                  ) : (
                    slots.map(({ id, date, time }, index) => {
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
                            <KernCluster wrap={false} gap="sm" justify="center">
                              <RowButton
                                intent={`edit-slot:${id}`}
                                icon="edit"
                                label={`Zeitfenster ${label} bearbeiten`}
                              />
                              <RowButton
                                intent={`copy-slot:${id}`}
                                icon="content-copy"
                                label={`Zeitfenster ${label} kopieren`}
                              />
                              <RowButton
                                intent={`delete-slot:${id}`}
                                icon="delete"
                                label={`Zeitfenster ${label} löschen`}
                              />
                            </KernCluster>
                          </KernCell>
                        </KernRow>
                      );
                    })
                  )}
                </KernTableBody>
              </KernTable>
              <AddButton
                intent="add-slot"
                label="Zeitfenster hinzufügen"
                limit={slots.length >= MAX_SLOTS}
                hint={`Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`}
                hintId="add-hint"
              />
              {errors?.slots && <ErrorMessage id="slots-error">{errors.slots}</ErrorMessage>}
            </KernStack>
          </KernStack>

          <FormActions>
            <KernButton type="submit" name="intent" value="cancel" style="secondary">
              <KernLabel>Abbrechen</KernLabel>
            </KernButton>
            <KernButton type="submit" name="intent" value="next" disabled={pending}>
              Weiter
            </KernButton>
          </FormActions>
        </FormStack>
      </FlowPage>
    </AppShell>
  );
}

// The table keeps its header when it is empty and says so in a white row.
function EmptyRow({ children }: Readonly<{ children: string }>) {
  return (
    <KernRow>
      <KernCell colSpan={3} className="create-termin__empty">
        {children}
      </KernCell>
    </KernRow>
  );
}

function RowButton({
  intent,
  icon,
  label,
}: Readonly<{ intent: string; icon: KernIconName; label: string }>) {
  return (
    <KernButton type="submit" name="intent" value={intent} style="tertiary" aria-label={label}>
      <KernIcon name={icon} />
    </KernButton>
  );
}

function AddButton({
  intent,
  label,
  limit,
  hint,
  hintId,
}: Readonly<{ intent: string; label: string; limit: boolean; hint: string; hintId: string }>) {
  return (
    <>
      <KernButton
        type="submit"
        name="intent"
        value={intent}
        style="secondary"
        className="kern-mt-md"
        disabled={limit}
        aria-describedby={limit ? hintId : undefined}
      >
        <KernIcon name="add" />
        <KernLabel>{label}</KernLabel>
      </KernButton>
      {limit && (
        <p className="kern-hint" id={hintId}>
          {hint}
        </p>
      )}
    </>
  );
}
