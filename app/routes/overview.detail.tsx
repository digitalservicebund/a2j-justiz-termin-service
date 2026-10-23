import { data, Link, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyLinkButton } from "~/components/shared/CopyLinkButton";
import { KernBadge } from "~/components/shared/kern/KernBadge";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { getDb } from "~/database/database";

import { groupSlotsByDay, type DayWindows } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";
import { describeStatus, formatInstant } from "./overview.status";

import "./overview.detail.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status === "draft") throw redirect(`/overview/${encodeURIComponent(id)}/confirm`);
  const { aktenzeichen, confirmedSlot } = appointment;
  const days = groupSlotsByDay(appointment.slots.map(rangeToSlot), " bis ");

  if (appointment.status === "confirmed") {
    // A confirmed appointment always has its slot; without it there is nothing to show.
    if (!confirmedSlot) throw data("Not found", { status: 404 });
    return {
      user,
      aktenzeichen,
      state: "confirmed" as const,
      // Once the Termin is over, the page looks back at it and lists the proposed windows.
      past: confirmedSlot.end < new Date(),
      badge: describeStatus({ status: appointment.status, confirmedSlot }),
      termin: formatInstant(confirmedSlot.start),
      days,
    };
  }

  if (appointment.status === "open") {
    if (!appointment.universalToken) throw data("Not found", { status: 404 });
    const { origin } = new URL(request.url);
    return {
      user,
      aktenzeichen,
      state: "open" as const,
      selectUrl: `/overview/${encodeURIComponent(id)}/select`,
      days,
      surveyUrl: `${origin}/umfrage/${encodeURIComponent(appointment.universalToken)}`,
    };
  }

  return { user, aktenzeichen, state: "cancelled" as const, days };
}

function BackLink() {
  return (
    <Link className="kern-link overview-detail__back" to="/overview">
      <KernIcon name="arrow-back" size="small" />
      Zurück zu den Terminumfragen
    </Link>
  );
}

function Verhandlungsdaten({ aktenzeichen }: Readonly<{ aktenzeichen: string }>) {
  return (
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
  );
}

function Zeitfenster({ days }: Readonly<{ days: DayWindows[] }>) {
  return (
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
  );
}

export default function OverviewDetail() {
  const detail = useLoaderData<typeof loader>();
  const { user, aktenzeichen } = detail;
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
        <BackLink />

        {detail.state === "confirmed" ? (
          <>
            <header className="overview-detail__header">
              <KernBadge type={detail.badge.type}>
                {detail.badge.type === "success" && <KernIcon name="success" />}
                <span className="kern-label">{detail.badge.text}</span>
              </KernBadge>
              <h1 className="kern-heading-large">
                {detail.past
                  ? `Der Termin war am ${detail.termin}`
                  : `Der Termin ist am ${detail.termin}.`}
              </h1>
            </header>
            <Verhandlungsdaten aktenzeichen={aktenzeichen} />
            {detail.past && <Zeitfenster days={detail.days} />}
          </>
        ) : detail.state === "open" ? (
          <OpenForReplies
            aktenzeichen={aktenzeichen}
            days={detail.days}
            selectUrl={detail.selectUrl}
            surveyUrl={detail.surveyUrl}
          />
        ) : (
          <NoOptionWorks aktenzeichen={aktenzeichen} days={detail.days} />
        )}
      </div>
    </AppShell>
  );
}

function OpenForReplies({
  aktenzeichen,
  days,
  selectUrl,
  surveyUrl,
}: Readonly<{ aktenzeichen: string; days: DayWindows[]; selectUrl: string; surveyUrl: string }>) {
  return (
    <>
      <header className="overview-detail__header">
        <KernBadge type="info">
          <KernIcon name="info" />
          <span className="kern-label">Offen für Rückmeldungen</span>
        </KernBadge>
        <h1 className="kern-heading-large">
          Die Terminumfrage ist aktiv und die Verfahrensbeteiligten können ihre Verfügbarkeiten
          teilen.
        </h1>
      </header>

      <div className="overview-detail__actions">
        <Link className="kern-btn kern-btn--primary" to={selectUrl}>
          <KernIcon name="check" />
          <span className="kern-label">Termin auswählen</span>
        </Link>
        <CopyLinkButton url={surveyUrl} />
      </div>

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />
      <Zeitfenster days={days} />
    </>
  );
}

function NoOptionWorks({
  aktenzeichen,
  days,
}: Readonly<{ aktenzeichen: string; days: DayWindows[] }>) {
  return (
    <>
      <header className="overview-detail__header">
        <KernBadge type="danger">
          <KernIcon name="danger" />
          <span className="kern-label">Kein Zeitfenster passt</span>
        </KernBadge>
        <div>
          <h1 className="kern-heading-large">
            Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.
          </h1>
          <p className="kern-body">Starten Sie eine neue Terminumfrage.</p>
        </div>
      </header>

      <Link className="kern-btn kern-btn--primary" to="/overview/new">
        <KernIcon name="add" />
        <span className="kern-label">Terminumfrage erstellen</span>
      </Link>

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />

      <Zeitfenster days={days} />
    </>
  );
}
