import { Form, useLoaderData, useSubmit } from "react-router";

import { listAppointments } from "~/adapters/appointments/appointments.server";
import { requireUser } from "~/adapters/session/session";
import { A2JIcon } from "~/components/shared/a2j/A2JIcon";
import { AppShell } from "~/components/shared/AppShell";
import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernBadge, type KernBadgeType } from "~/components/shared/kern/KernBadge";
import { KernFormSelect } from "~/components/shared/kern/KernFormSelect";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { ReportProblemButton } from "~/components/shared/ReportProblemButton";
import { SideNav } from "~/components/shared/SideNav";
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
function detailHref(id: string, status: AppointmentStatus): string {
  const encoded = encodeURIComponent(id);
  return status === "draft" ? `/overview/${encoded}/confirm` : `/overview/${encoded}`;
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
        aktenzeichen,
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

const navItems = [
  {
    label: "Übersicht",
    icon: <KernIcon name="home" size="large" />,
    to: "/overview",
    current: true,
  },
  { label: "Abwesenheiten", icon: <A2JIcon name="remove-circle" size="large" /> },
  { label: "Kalender abonnieren", icon: <A2JIcon name="calendar-add" size="large" /> },
  { label: "Einstellungen", icon: <A2JIcon name="settings" size="large" /> },
];

export default function Overview() {
  const { user, query, hasAppointments, entries } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const emptyMessage = hasAppointments
    ? "Keine Terminumfragen für diesen Filter."
    : "Sie haben keine Terminumfrage.";
  return (
    <AppShell user={user} breadcrumbs={[{ label: "Übersicht" }]} showReportProblem={false}>
      <DefaultPage width="wide">
        <div className="overview">
          <SideNav label="Bereiche" items={navItems} />
          <div className="overview__content">
            <h1 className="kern-sr-only">Übersicht</h1>
            <KernLinkButton to="/overview/new">
              <KernIcon name="add" />
              <KernLabel>Terminumfrage erstellen</KernLabel>
            </KernLinkButton>

            {/* Submits on every change; without JavaScript the button applies the choice. */}
            <Form
              method="get"
              className="overview__controls"
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
              <noscript>
                <button type="submit" className="kern-btn kern-btn--secondary">
                  <KernLabel>Anwenden</KernLabel>
                </button>
              </noscript>
            </Form>

            <KernTable className="overview__table" caption="Terminumfragen" hideCaption striped>
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

            <div className="overview__report">
              <ReportProblemButton />
            </div>
          </div>
        </div>
      </DefaultPage>
    </AppShell>
  );
}
