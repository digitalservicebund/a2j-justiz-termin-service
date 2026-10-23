import { data, Link, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyLinkButton } from "~/components/shared/CopyLinkButton";
import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernBadge } from "~/components/shared/kern/KernBadge";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
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
      <KernHeading size="medium" level={2} id="detail-verhandlungsdaten">
        Verhandlungsdaten
      </KernHeading>
      <KernDescriptionList column>
        <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
      </KernDescriptionList>
    </section>
  );
}

function Zeitfenster({ days }: Readonly<{ days: DayWindows[] }>) {
  return (
    <section aria-labelledby="detail-zeitfenster" className="overview-detail__section">
      <KernHeading size="medium" level={2} id="detail-zeitfenster">
        Zeitfenster
      </KernHeading>
      <KernDescriptionList className="overview-detail__windows">
        {days.map(({ key, label, times }) => (
          <KernDescriptionListItem key={key} label={label}>
            {times.map((time) => (
              <div key={time}>{time}</div>
            ))}
          </KernDescriptionListItem>
        ))}
      </KernDescriptionList>
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
        { label: "Verhandlungstermin-Finder", href: "/overview" },
        { label: "Übersicht", href: "/overview" },
        { label: aktenzeichen },
      ]}
    >
      <DefaultPage>
        <div className="overview-detail">
          <BackLink />

          {detail.state === "confirmed" ? (
            <>
              <header className="overview-detail__header">
                <KernBadge type={detail.badge.type}>
                  {detail.badge.type === "success" && <KernIcon name="success" />}
                  <KernLabel>{detail.badge.text}</KernLabel>
                </KernBadge>
                <KernHeading size="large" level={1}>
                  {detail.past
                    ? `Der Termin war am ${detail.termin}`
                    : `Der Termin ist am ${detail.termin}.`}
                </KernHeading>
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
      </DefaultPage>
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
          <KernLabel>Offen für Rückmeldungen</KernLabel>
        </KernBadge>
        <KernHeading size="large" level={1}>
          Die Terminumfrage ist aktiv und die Verfahrensbeteiligten können ihre Verfügbarkeiten
          teilen.
        </KernHeading>
      </header>

      <div className="overview-detail__actions">
        <KernLinkButton to={selectUrl}>
          <KernIcon name="check" />
          <KernLabel>Termin auswählen</KernLabel>
        </KernLinkButton>
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
          <KernLabel>Kein Zeitfenster passt</KernLabel>
        </KernBadge>
        <div>
          <KernHeading size="large" level={1}>
            Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.
          </KernHeading>
          <KernBody>Starten Sie eine neue Terminumfrage.</KernBody>
        </div>
      </header>

      <KernLinkButton to="/overview/new">
        <KernIcon name="add" />
        <KernLabel>Terminumfrage erstellen</KernLabel>
      </KernLinkButton>

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />

      <Zeitfenster days={days} />
    </>
  );
}
