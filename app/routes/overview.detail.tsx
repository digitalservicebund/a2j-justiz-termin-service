import { data, Link, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyLinkButton } from "~/components/shared/CopyLinkButton";
import { DefaultPage, PageSection } from "~/components/shared/DefaultPage";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { MainNav } from "~/components/shared/MainNav";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { formatInstant } from "~/core/domain/time/format";
import { getDb } from "~/database/database";
import { BASE_PATH } from "~/lib/base-path";

import { groupSlotsByDay, type DayWindows } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";
import { describeStatus } from "./overview.status";

import "./overview.detail.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  if (appointment.status === "draft") throw redirect(`/overview/${encodeURIComponent(id)}/confirm`);
  const { aktenzeichen, confirmedSlot } = appointment;
  const days = groupSlotsByDay(appointment.slots.map(rangeToSlot));

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
      surveyUrl: `${origin}${BASE_PATH}/umfrage/${encodeURIComponent(appointment.universalToken)}`,
    };
  }

  return { user, aktenzeichen, state: "cancelled" as const, days };
}

// "Montag, 3. August 2026 um 13:30" becomes "Montag, dem 3. August 2026 um 13:30" for the sentence.
function withDem(termin: string): string {
  return termin.replace(", ", ", dem ");
}

function BackLink({ children = "Zurück zu den Terminumfragen" }: Readonly<{ children?: string }>) {
  return (
    <Link className="kern-link overview-detail__back" to="/overview">
      <KernIcon name="arrow-back" size="small" />
      {children}
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
      breadcrumbs={[{ label: "Übersicht", href: "/overview" }, { label: "Terminumfrage" }]}
    >
      <PageSection width="wide">
        <div className="overview-detail__layout">
          <MainNav current="overview" />
          <DefaultPage width="content">
            <div className="overview-detail">
              {detail.state === "confirmed" && detail.past ? (
                <>
                  <ResultBanner
                    inline
                    type="default"
                    title={`Der Termin war am ${withDem(detail.termin)}.`}
                  />
                  <BackLink>Zur Übersicht</BackLink>
                  <Verhandlungsdaten aktenzeichen={aktenzeichen} />
                  <Zeitfenster days={detail.days} />
                </>
              ) : detail.state === "confirmed" ? (
                <>
                  <ResultBanner
                    inline
                    type="success"
                    title={`Der Termin ist am ${detail.termin}.`}
                  />
                  <BackLink>Zur Übersicht</BackLink>
                  <Verhandlungsdaten aktenzeichen={aktenzeichen} />
                  <Zeitfenster days={detail.days} />
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
        </div>
      </PageSection>
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
      <ResultBanner
        inline
        type="info"
        title="Die Terminumfrage ist aktiv und die Verfahrensbeteiligten können ihre Verfügbarkeiten teilen."
        actions={
          <>
            <KernLinkButton to={selectUrl}>
              <KernIcon name="check" />
              <KernLabel>Termin auswählen</KernLabel>
            </KernLinkButton>
            <CopyLinkButton url={surveyUrl} />
          </>
        }
      />
      <BackLink>Zur Übersicht</BackLink>

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
      <ResultBanner
        inline
        type="warning"
        title="Es gibt leider kein Zeitfenster, dass allen Verfahrensbeteiligten passt."
        message="Starten Sie eine neue Terminumfrage."
        actions={
          <KernLinkButton to="/overview/new">
            <KernIcon name="add" />
            <KernLabel>Terminumfrage erstellen</KernLabel>
          </KernLinkButton>
        }
      />
      <BackLink>Zur Übersicht</BackLink>

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />

      <Zeitfenster days={days} />
    </>
  );
}
