import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  addDraftParticipant,
  listParticipants,
  updateDraftParticipant,
} from "~/adapters/appointments/participants.server";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { FieldColumn, FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { getDb } from "~/database/database";
import { requireOwnAppointment } from "~/lib/auth/appointment-guard.server";
import { draftPath, NEW_ITEM, OVERVIEW_PATH } from "~/lib/web/paths";
import { notFound } from "~/lib/web/responses";

import { createTerminBreadcrumbs } from "./breadcrumbs";
import {
  emptyParticipant,
  MAX_PARTICIPANTS,
  parseParticipantForm,
  participantMessages,
  validateParticipant,
  type ParticipantErrors,
  type ParticipantFields,
} from "./participant.schema";

import "./draft.css";

type Params = { params: { appointmentId?: string; participantId?: string } };

// Only a draft can be changed.
async function loadDraft(request: Request, { params }: Params) {
  const { user, appointment } = await requireOwnAppointment(request, params, {
    status: "draft",
    otherwise: OVERVIEW_PATH,
  });
  return {
    user,
    appointment,
    participants: await listParticipants(getDb(), user.id, appointment.id),
  };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { user, appointment, participants } = await loadDraft(request, { params });
  const isNew = params.participantId === NEW_ITEM;
  const person = participants.find((candidate) => candidate.id === params.participantId);
  if (!isNew && !person) throw notFound();

  return {
    user,
    cancelHref: draftPath(appointment.id),
    values: {
      email: person?.email ?? "",
      safeId: person?.safeId ?? "",
      name: person?.name ?? "",
    } satisfies ParticipantFields,
  };
}

type ActionResult = { values: ParticipantFields; errors: ParticipantErrors };

export async function action({ request, params }: { request: Request } & Params) {
  const { user, appointment, participants } = await loadDraft(request, { params });
  const db = getDb();
  const isNew = params.participantId === NEW_ITEM;
  const values = parseParticipantForm(await request.formData());
  const reject = (errors: ParticipantErrors) =>
    data({ values, errors } satisfies ActionResult, { status: 400 });

  if (!isNew && !participants.some((person) => person.id === params.participantId)) {
    throw notFound();
  }
  if (isNew && participants.length >= MAX_PARTICIPANTS) {
    return reject({ email: participantMessages.tooManyParticipants });
  }

  const result = validateParticipant(values);
  if (!result.success) return reject(result.errors);

  const saved = isNew
    ? await addDraftParticipant(db, user.id, appointment.id, result.value)
    : await updateDraftParticipant(
        db,
        user.id,
        appointment.id,
        params.participantId ?? "",
        result.value,
      );
  if (!saved) throw notFound();
  return redirect(draftPath(appointment.id));
}

export default function CreateTerminParticipant() {
  const { user, cancelHref, values: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  // What the user just submitted wins over the saved person.
  const values = result?.values ?? saved ?? emptyParticipant;
  const errors = result?.errors ?? {};

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <FormStack method="post" noValidate>
          <KernStack gap="xs">
            <KernBody className="kern-m-none" size="small" bold>
              Verfahrensbeteiligte
            </KernBody>
            <KernHeading className="kern-m-none" size="large" level={1}>
              Wie erreichen Sie die Person?
            </KernHeading>
          </KernStack>

          <KernStack gap="xl" className="create-termin__person-fields">
            <FieldColumn size="medium">
              <KernFormInput
                id="email"
                name="email"
                type="email"
                label={
                  <>
                    E-Mail-Adresse <span className="create-termin__optional">- Optional</span>
                  </>
                }
                error={errors.email}
                autoComplete="off"
                defaultValue={values.email}
                // Remounts when a rejected submit brings back what was typed.
                key={`email-${values.email}`}
              />
            </FieldColumn>
            <FieldColumn size="medium">
              <KernFormInput
                id="safeId"
                name="safeId"
                label={
                  <>
                    SAFE-ID <span className="create-termin__optional">- Optional</span>
                  </>
                }
                hint="Ergänzen Sie die SAFE-ID, wenn die Person ein elektronisches Postfach hat, zum Beispiel beA."
                error={errors.safeId}
                autoComplete="off"
                spellCheck={false}
                defaultValue={values.safeId}
                key={`safeId-${values.safeId}`}
              />
            </FieldColumn>
            <FieldColumn size="medium">
              <KernFormInput
                id="name"
                name="name"
                label={
                  <>
                    Name <span className="create-termin__optional">- Optional</span>
                  </>
                }
                hint="Ergänzen Sie den Namen, wenn Sie weder eine persönliche E-Mail-Adresse noch eine SAFE-ID der Person haben."
                error={errors.name}
                autoComplete="off"
                defaultValue={values.name}
                key={`name-${values.name}`}
              />
            </FieldColumn>
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
      </FlowPage>
    </AppShell>
  );
}
