import { Form, redirect, useLoaderData, useNavigation } from "react-router";

import { requireRole } from "~/adapters/session/session";
import { deleteSitzungstag, listSitzungstage } from "~/adapters/users/sitzungstage.server";
import { AppShell } from "~/components/shared/AppShell";
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
import { formatIsoWeekday, formatTimeOfDay } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { NEW_ITEM, SETTINGS_PATH, sitzungstagPath } from "~/lib/web/paths";
import { badRequest, notFound } from "~/lib/web/responses";

import { settingsBreadcrumbs } from "./breadcrumbs";

import "./settings.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const sitzungstage = await listSitzungstage(getDb(), user.id);
  return {
    user,
    rows: sitzungstage.map(({ id, weekday, start, end }) => ({
      id,
      weekday: formatIsoWeekday(weekday),
      times: `${formatTimeOfDay(start)} bis ${formatTimeOfDay(end)}`,
    })),
  };
}

// The delete buttons of the rows submit "delete:<id>". It works without JavaScript.
const INTENT = "intent";
const DELETE = "delete:";

export async function action({ request }: { request: Request }) {
  const user = await requireRole(request, "richter");
  const value = (await request.formData()).get(INTENT);
  if (typeof value !== "string" || !value.startsWith(DELETE) || value === DELETE) {
    throw badRequest();
  }
  const deleted = await deleteSitzungstag(getDb(), user.id, value.slice(DELETE.length));
  if (!deleted) throw notFound();
  return redirect(SETTINGS_PATH);
}

export default function Settings() {
  const { user, rows } = useLoaderData<typeof loader>();
  const pending = useNavigation().state !== "idle";
  return (
    <AppShell user={user} breadcrumbs={settingsBreadcrumbs}>
      <SidebarPage current="settings" user={user} spacing="roomy">
        <KernStack gap="xl" align="start" className="settings">
          <Form method="post" className="kern-w-full">
            <KernHeading size="medium" level={1}>
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
