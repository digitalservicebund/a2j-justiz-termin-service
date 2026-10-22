import { Link, useLoaderData } from "react-router";

import { listAppointments } from "~/adapters/appointments/appointments.server";
import { requireUser } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { Badge, type BadgeType } from "~/components/shared/Badge";
import { Icon, type IconName } from "~/components/shared/Icon";
import { getDb } from "~/database/database";
import type { AppointmentStatus } from "~/database/types";

import { describeStatus } from "./overview.status";

import "./overview.css";

// Drafts continue on their confirmation page and appointments without a fitting slot have a detail
// page; the other states have no page yet.
function detailHref(id: string, status: AppointmentStatus): string | null {
  const encoded = encodeURIComponent(id);
  if (status === "draft") return `/overview/${encoded}/confirm`;
  if (status === "cancelled") return `/overview/${encoded}`;
  return null;
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const appointments = await listAppointments(getDb(), user.id);
  return {
    user,
    entries: appointments.map(({ id, aktenzeichen, status, confirmedSlot }) => ({
      id,
      aktenzeichen,
      href: detailHref(id, status),
      badge: describeStatus({ status, confirmedSlot }),
    })),
  };
}

const statusIcons: Partial<Record<BadgeType, IconName>> = {
  success: "success",
  danger: "danger",
  info: "info",
  warning: "warning",
};

export default function Overview() {
  const { user, entries } = useLoaderData<typeof loader>();
  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Startseite", href: "/", icon: "home" },
        { label: "Verhandlungstermin-Finder", href: "/home" },
        { label: "Übersicht" },
      ]}
    >
      <div className="page-shell__content overview__content">
        <h1 className="kern-sr-only">Übersicht</h1>
        <Link className="kern-btn kern-btn--primary" to="/overview/new">
          <Icon name="add" />
          <span className="kern-label">Terminumfrage erstellen</span>
        </Link>

        {entries.length === 0 ? (
          <p className="kern-body">Sie haben noch keine Terminumfragen erstellt.</p>
        ) : (
          <table className="kern-table overview__table">
            <thead className="kern-table__header">
              <tr className="kern-table__row">
                <th className="kern-table__header" scope="col">
                  Aktenzeichen
                </th>
                <th className="kern-table__header" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="kern-table__body">
              {entries.map(({ id, aktenzeichen, href, badge }) => {
                const icon = statusIcons[badge.type];
                return (
                  <tr className="kern-table__row" key={id}>
                    <td className="kern-table__cell">
                      {href ? (
                        <Link className="kern-link" to={href}>
                          {aktenzeichen}
                        </Link>
                      ) : (
                        aktenzeichen
                      )}
                    </td>
                    <td className="kern-table__cell">
                      <Badge type={badge.type}>
                        {icon && <Icon name={icon} />}
                        <span className="kern-label">{badge.text}</span>
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
