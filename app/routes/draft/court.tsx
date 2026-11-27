import { data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { setDraftCourt } from "~/adapters/appointments/appointments.server";
import { getDefaultCourt, setDefaultCourt } from "~/adapters/users/richter.server";
import { AppShell } from "~/components/shared/AppShell";
import { CourtSelect } from "~/components/shared/CourtSelect";
import { FlowPage } from "~/components/shared/FlowPage";
import { FieldColumn, FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { courtGroups } from "~/core/domain/court/court";
import { getDb } from "~/database/database";
import { requireOwnAppointment } from "~/lib/auth/appointment-guard.server";
import { parseCourtField, wantsSaveAsDefault } from "~/lib/web/court-field";
import { COURT_FIELD, SAVE_AS_DEFAULT_FIELD } from "~/lib/web/court-form";
import { draftPath, OVERVIEW_PATH } from "~/lib/web/paths";
import { notFound } from "~/lib/web/responses";

import { createTerminBreadcrumbs } from "./breadcrumbs";

type Params = { params: { appointmentId?: string } };

// Only the court of a draft can be changed.
const loadDraft = (request: Request, { params }: Params) =>
  requireOwnAppointment(request, params, { status: "draft", otherwise: OVERVIEW_PATH });

// Here the judge picks another court for one Terminumfrage than the default court, for a hearing
// somewhere else. The default court stays as it is; only a judge without one can save the picked
// court as the default.
export async function loader({ request, params }: { request: Request } & Params) {
  const { user, appointment } = await loadDraft(request, { params });
  const defaultCourt = await getDefaultCourt(getDb(), user.id);
  return {
    user,
    cancelHref: draftPath(appointment.id),
    courtCode: appointment.courtCode ?? defaultCourt,
    hasDefaultCourt: defaultCourt !== null,
    groups: courtGroups,
  };
}

type ActionResult = { courtCode: string; error: string };

export async function action({ request, params }: { request: Request } & Params) {
  const { user, appointment } = await loadDraft(request, { params });
  const db = getDb();
  const formData = await request.formData();
  const picked = parseCourtField(formData.get(COURT_FIELD), { required: true });
  if (picked.problem !== undefined || picked.code === null) {
    const courtCode = String(formData.get(COURT_FIELD) ?? "");
    return data({ courtCode, error: picked.problem ?? "" } satisfies ActionResult, { status: 400 });
  }

  if (!(await setDraftCourt(db, user.id, appointment.id, picked.code))) throw notFound();
  if (wantsSaveAsDefault(formData) && (await getDefaultCourt(db, user.id)) === null) {
    await setDefaultCourt(db, user.id, picked.code);
  }
  return redirect(draftPath(appointment.id));
}

export default function CreateTerminCourt() {
  const { user, cancelHref, courtCode, hasDefaultCourt, groups } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";

  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <FlowPage width="content" spacing="form">
        <FormStack method="post" noValidate>
          <KernStack gap="xs">
            <KernBody className="kern-m-none" size="small" bold>
              Verhandlungsdaten
            </KernBody>
            <KernHeading className="kern-m-none" size="large" level={1}>
              An welchem Gericht findet die Verhandlung statt?
            </KernHeading>
          </KernStack>

          <FieldColumn size="medium">
            <KernStack gap="sm">
              <CourtSelect
                id="court"
                name={COURT_FIELD}
                label="Gericht"
                hint={
                  hasDefaultCourt
                    ? "Das gilt nur für diese Terminumfrage. Ihr Standardgericht ändern Sie in den Einstellungen."
                    : undefined
                }
                groups={groups}
                // What the user just submitted wins over the saved court.
                defaultValue={(result?.courtCode ?? courtCode) || null}
                emptyLabel="Bitte auswählen"
                error={result?.error}
              />
              {!hasDefaultCourt && (
                <KernFormCheck
                  id="saveAsDefault"
                  type="checkbox"
                  name={SAVE_AS_DEFAULT_FIELD}
                  label="Als mein Standardgericht speichern"
                />
              )}
            </KernStack>
          </FieldColumn>

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
