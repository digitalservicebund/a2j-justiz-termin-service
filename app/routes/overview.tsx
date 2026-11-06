import { Form, useLoaderData, useSubmit } from "react-router";

import { listAppointments } from "~/adapters/appointments/appointments.server";
import { requireUser } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { KernBadge, type KernBadgeType } from "~/components/shared/kern/KernBadge";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormSelect } from "~/components/shared/kern/KernFormSelect";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
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
import { classNames, clusterClassName } from "~/components/shared/kern/layout";
import { SidebarPage } from "~/components/shared/SidebarPage";
import { getDb } from "~/database/database";
import type { AppointmentStatus } from "~/database/types";

import {
  applyOverviewQuery,
  parseOverviewQuery,
  sortLabels,
  statusFilterLabels,
  statusOrder,
} from "./overview.query";
import { describeStatus } from "./overview.status";

import "./overview.css";

// Drafts continue on their confirmation page, all other states have a detail page.
const NO_AKTENZEICHEN = "Ohne Aktenzeichen";

function detailHref(id: string, status: AppointmentStatus): string {
  const encoded = encodeURIComponent(id);
  // A draft may be incomplete, so it reopens in the form, not in the review.
  return status === "draft" ? `/overview/new?entwurf=${encoded}` : `/overview/${encoded}`;
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const query = parseOverviewQuery(new URL(request.url).searchParams);
  const appointments = await listAppointments(getDb(), user.id);
  return {
    user,
    query,
    // Tells "no appointments at all" from "none match the filter".
    hasAppointments: appointments.length > 0,
    entries: applyOverviewQuery(appointments, query).map(
      ({ id, aktenzeichen, status, confirmedSlot }) => ({
        id,
        // A draft can be saved before an Aktenzeichen is entered.
        aktenzeichen: aktenzeichen.trim() === "" ? NO_AKTENZEICHEN : aktenzeichen,
        href: detailHref(id, status),
        badge: describeStatus({ status, confirmedSlot }),
      }),
    ),
  };
}

const statusIcons: Partial<Record<KernBadgeType, KernIconName>> = {
  success: "success",
  danger: "danger",
  info: "info",
  warning: "warning",
};

export default function Overview() {
  const { user, query, hasAppointments, entries } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const emptyMessage = hasAppointments
    ? "Keine Terminumfragen für diesen Filter."
    : "Sie haben keine Terminumfrage.";
  return (
    <AppShell user={user} breadcrumbs={[{ label: "Übersicht" }]}>
      <SidebarPage current="overview" spacing="roomy">
        <KernStack gap="xl" align="start" className="overview__content">
          <h1 className="kern-sr-only">Übersicht</h1>
          <KernLinkButton to="/overview/new">
            <KernIcon name="add" />
            <KernLabel>Terminumfrage erstellen</KernLabel>
          </KernLinkButton>

          {/* With JavaScript every change submits; the button applies the choice without it. */}
          <Form
            method="get"
            className={classNames(
              "overview__controls",
              clusterClassName({ gap: "lg", align: "end" }),
            )}
            onChange={(event) => submit(event.currentTarget)}
          >
            <KernFormSelect id="sort" name="sort" label="Sortieren" defaultValue={query.sort}>
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </KernFormSelect>
            <KernFormSelect id="filter" name="filter" label="Filter" defaultValue={query.filter}>
              <option value="none">Keine</option>
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {statusFilterLabels[status]}
                </option>
              ))}
            </KernFormSelect>
            <KernButton type="submit" style="secondary">
              <KernLabel>Anwenden</KernLabel>
            </KernButton>
          </Form>

          {/* On a narrow screen the table scrolls inside its own region instead of widening the page. */}
          <section className="overview__table-scroll kern-w-full" aria-label="Terminumfragen">
            <KernTable
              className="overview__table kern-w-full"
              caption="Terminumfragen"
              hideCaption
              striped
            >
              <KernTableHead>
                <KernRow>
                  <KernColumn>Aktenzeichen</KernColumn>
                  <KernColumn>Status</KernColumn>
                  <KernColumn variant="action">Aktionen</KernColumn>
                </KernRow>
              </KernTableHead>
              <KernTableBody>
                {entries.length === 0 ? (
                  <KernRow>
                    <KernCell colSpan={3} className="overview__empty">
                      {emptyMessage}
                    </KernCell>
                  </KernRow>
                ) : (
                  entries.map(({ id, aktenzeichen, href, badge }) => {
                    const icon = statusIcons[badge.type];
                    return (
                      <KernRow key={id}>
                        <KernCell>{aktenzeichen}</KernCell>
                        <KernCell>
                          <KernBadge type={badge.type}>
                            {icon && <KernIcon name={icon} />}
                            <KernLabel>{badge.text}</KernLabel>
                          </KernBadge>
                        </KernCell>
                        <KernCell variant="action">
                          <KernLinkButton
                            style="secondary"
                            className="kern-btn--x-small"
                            to={href}
                            title="Öffnen"
                          >
                            <KernIcon name="arrow-forward" size="small" />
                            <KernLabel className="kern-sr-only">
                              {`Terminumfrage ${aktenzeichen} öffnen`}
                            </KernLabel>
                          </KernLinkButton>
                        </KernCell>
                      </KernRow>
                    );
                  })
                )}
              </KernTableBody>
            </KernTable>
          </section>
        </KernStack>
      </SidebarPage>
    </AppShell>
  );
}
