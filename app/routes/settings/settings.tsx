import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { requireRole } from "~/adapters/session/session";
import { getDefaultCourt, setDefaultCourt } from "~/adapters/users/richter.server";
import { deleteSitzungstag, listSitzungstage } from "~/adapters/users/sitzungstage.server";
import { AppShell } from "~/components/shared/AppShell";
import { CourtSelect } from "~/components/shared/CourtSelect";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { SidebarPage } from "~/components/shared/SidebarPage";
import { courtGroups } from "~/core/domain/court/court";
import { formatIsoWeekday, formatTimeOfDay } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { parseCourtField } from "~/lib/web/court-field";
import { COURT_FIELD } from "~/lib/web/court-form";
import { NEW_ITEM, SETTINGS_PATH, sitzungstagPath } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

import { settingsBreadcrumbs } from "./breadcrumbs";

import "./settings.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const sitzungstage = await listSitzungstage(getDb(), user.id);
  return {
    user,
    defaultCourt: await getDefaultCourt(getDb(), user.id),
    courtGroups,
    saved: new URL(request.url).searchParams.has(SAVED),
    rows: sitzungstage.map(({ id, weekday, start, end }) => ({
      id,
      weekday: formatIsoWeekday(weekday),
      times: `${formatTimeOfDay(start)} bis ${formatTimeOfDay(end)}`,
    })),
  };
}

// The delete buttons of the rows submit "delete:<id>", the button of the default court "court".
// It works without JavaScript.
const INTENT = "intent";
const DELETE = "delete:";
const COURT = "court";
// Set after the default court was saved, so the page can say so.
const SAVED = "gespeichert";

export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const formData = await request.formData();
  const value = formData.get(INTENT);
  if (value === COURT) {
    const picked = parseCourtField(formData.get(COURT_FIELD), { required: false });
    if (picked.problem !== undefined) {
      return data(
        { courtCode: String(formData.get(COURT_FIELD) ?? ""), error: picked.problem },
        { status: 400 },
      );
    }
    await setDefaultCourt(getDb(), user.id, picked.code);
    return redirect(`${SETTINGS_PATH}?${SAVED}`);
  }
  if (typeof value !== "string" || !value.startsWith(DELETE) || value === DELETE) {
    throw badRequest();
  }
  const deleted = await deleteSitzungstag(getDb(), user.id, value.slice(DELETE.length));
  if (!deleted) throw notFound();
  return redirect(SETTINGS_PATH);
}

export default function Settings() {
  const { user, rows, defaultCourt, courtGroups: groups, saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  return (
    <AppShell user={user} breadcrumbs={settingsBreadcrumbs}>
      <SidebarPage current="settings" user={user} spacing="roomy">
        <KernStack gap="xl" align="start" className="settings">
          <KernHeading size="medium" level={1} className="kern-sr-only">
            Einstellungen
          </KernHeading>
          <Form method="post" className="kern-w-full" noValidate>
            <KernStack gap="md" align="start">
              <KernHeading size="medium" level={2} id="standardgericht">
                Standardgericht
              </KernHeading>
              {saved && !result && (
                <KernAlert type="success" title="Ihr Standardgericht wurde gespeichert." />
              )}
              <div className="settings__court">
                <CourtSelect
                  id="court"
                  name={COURT_FIELD}
                  label="Gericht, an dem Sie normalerweise arbeiten"
                  hint="Neue Terminumfragen starten mit diesem Gericht. Sie können es für jede Terminumfrage ändern."
                  groups={groups}
                  defaultValue={(result?.courtCode ?? defaultCourt) || null}
                  emptyLabel="Kein Standardgericht"
                  error={result?.error}
                />
              </div>
              <KernButton type="submit" name={INTENT} value={COURT} disabled={pending}>
                Speichern
              </KernButton>
            </KernStack>
          </Form>
          <Form method="post" className="kern-w-full">
            <KernHeading size="medium" level={2}>
              Sitzungstage und reguläre Verhandlungszeiten
            </KernHeading>
            <KernTable
              caption="Sitzungstage und reguläre Verhandlungszeiten"
              hideCaption
              striped={rows.length > 0}
              className="settings__table kern-w-full"
            >
              <KernTableHead>
                <KernRow>
                  <KernColumn>Wochentag</KernColumn>
                  <KernColumn>Reguläre Verhandlungszeiten</KernColumn>
                  <KernColumn variant="action">Aktionen</KernColumn>
                </KernRow>
              </KernTableHead>
              <KernTableBody>
                {rows.length === 0 ? (
                  <KernRow>
                    <KernCell colSpan={3} className="settings__empty">
                      Sie haben keine Sitzungstage hinzugefügt.
                    </KernCell>
                  </KernRow>
                ) : (
                  rows.map(({ id, weekday, times }) => {
                    const label = `Sitzungstag ${weekday}, ${times}`;
                    return (
                      <KernRow key={id}>
                        <KernCell>{weekday}</KernCell>
                        <KernCell className="settings__times">{times}</KernCell>
                        <KernCell variant="action">
                          <KernCluster wrap={false} gap="sm" justify="end">
                            <KernLinkButton
                              style="tertiary"
                              to={sitzungstagPath(id)}
                              aria-label={`${label} bearbeiten`}
                            >
                              <KernIcon name="edit" />
                            </KernLinkButton>
                            <KernButton
                              type="submit"
                              name={INTENT}
                              value={`${DELETE}${id}`}
                              style="tertiary"
                              disabled={pending}
                              aria-label={`${label} löschen`}
                            >
                              <KernIcon name="delete" />
                            </KernButton>
                          </KernCluster>
                        </KernCell>
                      </KernRow>
                    );
                  })
                )}
              </KernTableBody>
            </KernTable>
          </Form>
          <KernLinkButton style="secondary" to={sitzungstagPath(NEW_ITEM)}>
            <KernIcon name="add" />
            <KernLabel>Sitzungstag hinzufügen</KernLabel>
          </KernLinkButton>
        </KernStack>
      </SidebarPage>
    </AppShell>
  );
}
