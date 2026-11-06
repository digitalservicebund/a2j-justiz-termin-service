import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import {
  addDraftParticipant,
  listParticipants,
  updateDraftParticipant,
} from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernGrid, KernGridCol } from "~/components/shared/kern/KernGrid";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { stackClassName } from "~/components/shared/kern/layout";
import { getDb } from "~/database/database";

import {
  emptyParticipant,
  MAX_PARTICIPANTS,
  parseParticipantForm,
  participantMessages,
  validateParticipant,
  type ParticipantErrors,
  type ParticipantFields,
} from "./create-termin.participant.schema";
import { draftHref, NEW_SLOT } from "./create-termin.paths";
import { createTerminBreadcrumbs } from "./create-termin.review";

import "./create-termin.css";

type Params = { params: { appointmentId?: string; participantId?: string } };

const notFound = () => data("Not found", { status: 404 });

// Only a draft can be changed.
async function loadDraft(request: Request, { params }: Params) {
  const user = await requireRole(request, "richter");
  const db = getDb();
  const appointment = await getAppointment(db, user.id, params.appointmentId ?? "");
  if (!appointment) throw notFound();
  if (appointment.status !== "draft") throw redirect("/overview");
  return { user, appointment, participants: await listParticipants(db, user.id, appointment.id) };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { user, appointment, participants } = await loadDraft(request, { params });
  const isNew = params.participantId === NEW_SLOT;
  const person = participants.find((candidate) => candidate.id === params.participantId);
  if (!isNew && !person) throw notFound();

  return {
    user,
    cancelHref: draftHref(appointment.id),
    values: { email: person?.email ?? "", name: person?.name ?? "" } satisfies ParticipantFields,
  };
}

type ActionResult = { values: ParticipantFields; errors: ParticipantErrors };

export async function action({ request, params }: { request: Request } & Params) {
  const { user, appointment, participants } = await loadDraft(request, { params });
  const db = getDb();
  const isNew = params.participantId === NEW_SLOT;
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
  return redirect(draftHref(appointment.id));
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
        <Form method="post" className={stackClassName({ gap: "xl" }, "form")} noValidate>
          <KernStack gap="xs">
            <KernBody size="small" bold margin="none">
              Verfahrensbeteiligte
            </KernBody>
            <KernHeading size="large" level={1} margin="none">
              Wie lautet die E-Mail-Adresse der Person?
            </KernHeading>
          </KernStack>

          <KernStack gap="xl" className="create-termin__person-fields">
            <KernGrid>
              <KernGridCol md={8}>
                <KernFormInput
                  id="email"
                  name="email"
                  type="email"
                  label="E-Mail-Adresse"
                  error={errors.email}
                  autoComplete="off"
                  defaultValue={values.email}
                  // Remounts when a rejected submit brings back what was typed.
                  key={`email-${values.email}`}
                />
              </KernGridCol>
            </KernGrid>
            <KernGrid>
              <KernGridCol md={8}>
                <KernFormInput
                  id="name"
                  name="name"
                  label={
                    <>
                      Name <span className="create-termin__optional">- Optional</span>
                    </>
                  }
                  hint="Ergänzen Sie den Namen, wenn Sie keine persönliche E-Mail-Adresse der Person haben."
                  error={errors.name}
                  autoComplete="off"
                  defaultValue={values.name}
                  key={`name-${values.name}`}
                />
              </KernGridCol>
            </KernGrid>
          </KernStack>

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
