import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  createDraftAppointment,
  deleteDraftIfEmpty,
  deleteDraftSlot,
  getAppointment,
  updateDraftDetails,
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
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernStack } from "~/components/shared/kern/KernStack";
import { KernCell } from "~/components/shared/kern/KernTable";
import { getDb } from "~/database/database";
import { getOwnAppointment } from "~/lib/appointment-guard.server";
import {
  confirmDraftPath,
  draftPath,
  NEW_ITEM,
  OVERVIEW_PATH,
  participantPath,
  slotPath,
} from "~/lib/paths";
import { badRequest, notFound } from "~/lib/responses";

import { createTerminBreadcrumbs } from "./breadcrumbs";
import { DraftTable } from "./draft-table";
import { INTENT, intent, parseIntent } from "./intent";
import { MAX_PARTICIPANTS } from "./participant.schema";
import {
  aktenzeichenProblem,
  MAX_SLOTS,
  parseMinDuration,
  validateCreateTermin,
  type CreateTerminErrors,
} from "./schema";
import { describeSlot, rangeToSlot } from "./slots";

import "./draft.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const draftId = new URL(request.url).searchParams.get("entwurf");
  if (!draftId) return { user, draft: null };

  // The draft is the only place the entered data lives, so every visit reads it from there.
  const appointment = await getOwnAppointment(user.id, draftId, {
    status: "draft",
    otherwise: OVERVIEW_PATH,
  });
  return {
    user,
    draft: {
      id: appointment.id,
      aktenzeichen: appointment.aktenzeichen,
      minDurationMinutes: appointment.minDurationMinutes ?? null,
      participants: await listParticipants(getDb(), user.id, appointment.id),
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
  // As typed, so a rejected submit can show it again.
  minDuration: string;
  errors: {
    aktenzeichen?: string;
    minDuration?: string;
    slots?: string;
    rows: CreateTerminErrors["rows"];
  };
};

// Every button of the form submits the Aktenzeichen and the minimum duration with it, so nothing
// typed is lost on the way to another page. The intent says what the user asked for; the buttons of a row carry its id.
export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const db = getDb();
  const formData = await request.formData();
  // Checked before anything is saved, so a request no button can send changes nothing.
  const submitted = parseIntent(formData.get(INTENT));
  if (!submitted) throw badRequest();
  const aktenzeichen = String(formData.get("aktenzeichen") ?? "");
  const minDuration = String(formData.get("minDuration") ?? "");
  const draftIdValue = formData.get("appointmentId");
  const draftId = typeof draftIdValue === "string" ? draftIdValue : "";

  if (submitted.command === "cancel") {
    if (draftId) await deleteDraftIfEmpty(db, user.id, draftId);
    return redirect(OVERVIEW_PATH);
  }

  const final = submitted.command === "next";
  const problem = aktenzeichenProblem(aktenzeichen, { required: final });
  const duration = parseMinDuration(minDuration, { required: final });
  const rejected = (errors: Partial<ActionResult["errors"]>) =>
    data({ aktenzeichen, minDuration, errors: { rows: {}, ...errors } } satisfies ActionResult, {
      status: 400,
    });
  if (problem || duration.problem !== undefined) {
    return rejected({ aktenzeichen: problem, minDuration: duration.problem });
  }

  const details = { aktenzeichen: aktenzeichen.trim(), minDurationMinutes: duration.minutes };
  let id = draftId;
  if (id) {
    if (!(await updateDraftDetails(db, user.id, id, details))) throw notFound();
  } else if (final) {
    // Nothing was entered, so there is no draft; the checks below report what is missing.
  } else {
    id = await createDraftAppointment(db, user.id, details);
  }

  switch (submitted.command) {
    case "add-slot":
      return redirect(slotPath(id, NEW_ITEM));
    case "edit-slot":
      return redirect(slotPath(id, submitted.id));
    case "copy-slot":
      return redirect(slotPath(id, NEW_ITEM, submitted.id));
    case "delete-slot":
      if (!(await deleteDraftSlot(db, user.id, id, submitted.id))) throw notFound();
      return redirect(draftPath(id));
    case "add-person":
      return redirect(participantPath(id, NEW_ITEM));
    case "edit-person":
      return redirect(participantPath(id, submitted.id));
    case "delete-person":
      if (!(await deleteDraftParticipant(db, user.id, id, submitted.id))) throw notFound();
      return redirect(draftPath(id));
    case "next": {
      const appointment = id ? await getAppointment(db, user.id, id) : undefined;
      const result = validateCreateTermin({
        aktenzeichen,
        minDurationMinutes: duration.minutes,
        slots: appointment?.slots.map(rangeToSlot) ?? [],
      });
      if (!result.success) {
        const { errors } = result;
        return data({ aktenzeichen, minDuration, errors } satisfies ActionResult, {
          status: 400,
        });
      }
      return redirect(confirmDraftPath(id));
    }
  }
}

export default function CreateTermin() {
  const { user, draft } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  // What the user just submitted wins over the saved draft.
  const aktenzeichen = result?.aktenzeichen ?? draft?.aktenzeichen ?? "";
  const minDuration = result?.minDuration ?? draft?.minDurationMinutes?.toString() ?? "";
  const errors = result?.errors;
  const slots = draft?.slots ?? [];
  const participants = draft?.participants ?? [];
  const rowErrors = (index: number) => Object.values(errors?.rows[index] ?? {});

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <FormStack method="post" noValidate>
          {/* Pressing Enter in a field submits the first button, which has to be "Weiter". */}
          <button
            type="submit"
            name={INTENT}
            value={intent({ command: "next" })}
            hidden
            tabIndex={-1}
          />
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
            <FieldColumn size="medium">
              <KernFormInput
                id="minDuration"
                label="Mindestdauer der Verhandlung in Minuten"
                hint="Zum Beispiel 15, 30, 60, 90 oder 120. Kein Zeitfenster darf kürzer sein."
                error={errors?.minDuration}
                name="minDuration"
                defaultValue={minDuration}
                // Remounts when a rejected submit brings back what was typed.
                key={minDuration}
                width={4}
                maxLength={4}
                inputMode="numeric"
                autoComplete="off"
              />
            </FieldColumn>
          </KernStack>

          <KernStack as="section" gap="md" aria-labelledby="verfahrensbeteiligte">
            <KernStack gap="xs">
              <KernHeading
                className="kern-m-none"
                size="medium"
                level={2}
                id="verfahrensbeteiligte"
              >
                Geben Sie alle Verfahrensbeteiligten an
              </KernHeading>
              <KernBody className="kern-m-none">
                Personen ohne E-Mail-Adresse können Sie später mit einem Link zur Terminumfrage
                einladen.
              </KernBody>
            </KernStack>
            <DraftTable
              caption="Verfahrensbeteiligte"
              columns={["E-Mail-Adresse", "SAFE-ID", "Name"]}
              rows={participants}
              empty="Sie haben keine Verfahrensbeteiligten angegeben."
              renderCells={({ email, safeId, name }) => (
                <>
                  <KernCell>{email}</KernCell>
                  <KernCell className="create-termin__safe-id">{safeId}</KernCell>
                  <KernCell>{name}</KernCell>
                </>
              )}
              actions={({ id, email, safeId, name }) => {
                const label = `Person ${email ?? safeId ?? name}`;
                return [
                  {
                    intent: { command: "edit-person", id },
                    icon: "edit",
                    label: `${label} bearbeiten`,
                  },
                  {
                    intent: { command: "delete-person", id },
                    icon: "delete",
                    label: `${label} löschen`,
                  },
                ];
              }}
              add={{
                intent: { command: "add-person" },
                label: "Person hinzufügen",
                limit: participants.length >= MAX_PARTICIPANTS,
                hint: `Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`,
                hintId: "add-person-hint",
              }}
            />
          </KernStack>

          <KernStack as="section" gap="md" aria-labelledby="zeitfenster">
            <KernHeading size="medium" level={2} id="zeitfenster">
              Zeitfenster
            </KernHeading>

            <DraftTable
              caption="Zeitfenster"
              columns={["Datum", "Uhrzeit"]}
              rows={slots}
              empty="Sie haben keine Zeitfenster angegeben."
              renderCells={({ id, date, time }, index) => (
                <>
                  <KernCell>{date}</KernCell>
                  <KernCell>
                    {time}
                    {rowErrors(index).map((message, position) => (
                      <ErrorMessage id={`slot-${id}-error-${position}`} key={message}>
                        {message}
                      </ErrorMessage>
                    ))}
                  </KernCell>
                </>
              )}
              actions={({ id, date, time }) => {
                const label = `Zeitfenster ${date}, ${time}`;
                return [
                  {
                    intent: { command: "edit-slot", id },
                    icon: "edit",
                    label: `${label} bearbeiten`,
                  },
                  {
                    intent: { command: "copy-slot", id },
                    icon: "content-copy",
                    label: `${label} kopieren`,
                  },
                  {
                    intent: { command: "delete-slot", id },
                    icon: "delete",
                    label: `${label} löschen`,
                  },
                ];
              }}
              add={{
                intent: { command: "add-slot" },
                label: "Zeitfenster hinzufügen",
                limit: slots.length >= MAX_SLOTS,
                hint: `Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`,
                hintId: "add-hint",
              }}
              error={errors?.slots ? { id: "slots-error", message: errors.slots } : undefined}
            />
          </KernStack>

          <FormActions>
            <KernButton
              type="submit"
              name={INTENT}
              value={intent({ command: "cancel" })}
              style="secondary"
            >
              <KernLabel>Abbrechen</KernLabel>
            </KernButton>
            <KernButton
              type="submit"
              name={INTENT}
              value={intent({ command: "next" })}
              disabled={pending}
            >
              Weiter
            </KernButton>
          </FormActions>
        </FormStack>
      </FlowPage>
    </AppShell>
  );
}
