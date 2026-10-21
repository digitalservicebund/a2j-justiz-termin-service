import { useLoaderData } from "react-router";

import { requireUser } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { Badge, type BadgeType } from "~/components/shared/Badge";
import { Button } from "~/components/shared/Button";
import { Icon, type IconName } from "~/components/shared/Icon";

import "./overview.css";

export async function loader({ request }: { request: Request }) {
  return { user: await requireUser(request) };
}

type OverviewEntry = {
  title: string;
  status: string;
  statusType: BadgeType;
};

// Hardcoded until the overview is backed by real data.
const entries: OverviewEntry[] = [
  {
    title: "574 C 65412/26",
    status: "Termin ist Montag, 9. November 2026 um 15:30",
    statusType: "success",
  },
  { title: "574 C 65412/26", status: "Kein Zeitfenster passt", statusType: "danger" },
  { title: "574 C 65412/26", status: "Offen für Rückmeldungen", statusType: "info" },
  { title: "574 C 65412/26", status: "Montag, 3. August 2026 um 13:30", statusType: "custom-grey" },
];

const statusIcons: Partial<Record<BadgeType, IconName>> = {
  success: "success",
  danger: "danger",
  info: "info",
  warning: "warning",
};

// Targets for these links are not defined in the design yet.
const TODO_HREF = "#";

export default function Overview() {
  const { user } = useLoaderData<typeof loader>();
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
        <Button type="button">
          <Icon name="add" />
          <span className="kern-label">Terminumfrage erstellen</span>
        </Button>

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
            {entries.map(({ title, status, statusType }) => {
              const icon = statusIcons[statusType];
              return (
                <tr className="kern-table__row" key={status}>
                  <td className="kern-table__cell">
                    <a className="kern-link" href={TODO_HREF}>
                      {title}
                    </a>
                  </td>
                  <td className="kern-table__cell">
                    <Badge type={statusType}>
                      {icon && <Icon name={icon} />}
                      <span className="kern-label">{status}</span>
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
