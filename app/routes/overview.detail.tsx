import { data, Link, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { Badge } from "~/components/shared/Badge";
import { Icon } from "~/components/shared/Icon";
import { getDb } from "~/database/database";

import { groupSlotsByDay } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";

import "./overview.detail.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status === "draft") throw redirect(`/overview/${encodeURIComponent(id)}/confirm`);
  // Only the "no slot fits" state has a detail page so far.
  if (appointment.status !== "cancelled") throw data("Not found", { status: 404 });

  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    days: groupSlotsByDay(appointment.slots.map(rangeToSlot), " bis "),
  };
}

export default function OverviewDetail() {
  const { user, aktenzeichen, days } = useLoaderData<typeof loader>();
  return (
    <AppShell
      user={user}
      breadcrumbs={[
        { label: "Startseite", href: "/", icon: "home" },
        { label: "Verhandlungstermin-Finder", href: "/home" },
        { label: "Übersicht", href: "/overview" },
        { label: aktenzeichen },
      ]}
    >
      <div className="overview-detail">
        <Link className="kern-link overview-detail__back" to="/overview">
          <Icon name="arrow-back" size="small" />
          Zurück zu den Terminumfragen
        </Link>

        <header className="overview-detail__header">
          <Badge type="danger">
            <Icon name="danger" />
            <span className="kern-label">Kein Zeitfenster passt</span>
          </Badge>
          <div>
            <h1 className="kern-heading-large">
              Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.
            </h1>
            <p className="kern-body">Starten Sie eine neue Terminumfrage.</p>
          </div>
        </header>

        <Link className="kern-btn kern-btn--primary" to="/overview/new">
          <Icon name="add" />
          <span className="kern-label">Terminumfrage erstellen</span>
        </Link>

        <section aria-labelledby="detail-verhandlungsdaten" className="overview-detail__section">
          <h2 className="kern-heading-medium" id="detail-verhandlungsdaten">
            Verhandlungsdaten
          </h2>
          <dl className="kern-description-list kern-description-list--col">
            <div className="kern-description-list-item">
              <dt className="kern-description-list-item__key">Aktenzeichen</dt>
              <dd className="kern-description-list-item__value">{aktenzeichen}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="detail-zeitfenster" className="overview-detail__section">
          <h2 className="kern-heading-medium" id="detail-zeitfenster">
            Zeitfenster
          </h2>
          <dl className="kern-description-list overview-detail__windows">
            {days.map(({ key, label, times }) => (
              <div className="kern-description-list-item" key={key}>
                <dt className="kern-description-list-item__key">{label}</dt>
                <dd className="kern-description-list-item__value">
                  {times.map((time) => (
                    <div key={time}>{time}</div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
