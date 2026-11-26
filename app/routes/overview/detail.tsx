import { Link, useActionData, useLoaderData } from "react-router";

import { AppShell } from "~/components/shared/AppShell";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { classNames, clusterClassName } from "~/components/shared/kern/layout";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { SidebarPage } from "~/components/shared/SidebarPage";
import { SurveyLinkField } from "~/components/shared/SurveyLinkField";
import { formatInstant } from "~/core/domain/time/format";
import { PUBLISHED, requireOwnAppointment } from "~/lib/auth/appointment-guard.server";
import {
  appointmentPath,
  confirmDraftPath,
  NEW_APPOINTMENT_PATH,
  OVERVIEW_PATH,
  selectPath,
  surveyUrl,
} from "~/lib/web/paths";
import { notFound } from "~/lib/web/responses";
import { groupSlotsByDay, type DayWindows } from "~/routes/draft/slot-days";
import { rangeToSlot } from "~/routes/draft/slots";

import { Guests, type GuestRow } from "./guests";
import { inviteGuest, loadGuestRows } from "./invite.server";
import { describeStatus } from "./status";

import "./detail.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  // A draft has not been published yet, so it is reviewed first.
  const { user, id, appointment } = await requireOwnAppointment(request, params, {
    status: PUBLISHED,
    otherwise: confirmDraftPath,
  });
  const { aktenzeichen, confirmedSlot } = appointment;
  const days = groupSlotsByDay(appointment.slots.map(rangeToSlot));
  const guests = await loadGuestRows(user.id, id, new Date());

  if (appointment.status === "confirmed") {
    // A confirmed appointment always has its slot; without it there is nothing to show.
    if (!confirmedSlot) throw notFound();
    return {
      user,
      aktenzeichen,
      state: "confirmed" as const,
      // Once the Termin is over, the page looks back at it and lists the proposed windows.
      past: confirmedSlot.end < new Date(),
      badge: describeStatus({ status: appointment.status, confirmedSlot }),
      termin: formatInstant(confirmedSlot.start),
      days,
      guests,
    };
  }

  if (appointment.status === "open") {
    if (!appointment.universalToken) throw notFound();
    const { origin } = new URL(request.url);
    return {
      user,
      aktenzeichen,
      state: "open" as const,
      selectUrl: selectPath(id),
      days,
      guests,
      surveyUrl: surveyUrl(origin, appointment.universalToken),
    };
  }

  return { user, aktenzeichen, state: "cancelled" as const, days, guests };
}

export function action(args: { request: Request } & Params) {
  return inviteGuest(args, appointmentPath);
}

// "Montag, 3. August 2026 um 13:30" becomes "Montag, dem 3. August 2026 um 13:30" for the sentence.
function withDem(termin: string): string {
  return termin.replace(", ", ", dem ");
}

function BackLink({ children = "Zurück zu den Terminumfragen" }: Readonly<{ children?: string }>) {
  return (
    <Link
      className={classNames(
        "kern-link",
        clusterClassName({ inline: true, wrap: false, gap: "xxs", align: "center" }),
      )}
      to={OVERVIEW_PATH}
    >
      <KernIcon name="arrow-back" size="small" />
      {children}
    </Link>
  );
}

function Verhandlungsdaten({ aktenzeichen }: Readonly<{ aktenzeichen: string }>) {
  return (
    <KernStack
      as="section"
      gap="sm"
      aria-labelledby="detail-verhandlungsdaten"
      className="kern-w-full"
    >
      <KernHeading size="medium" level={2} id="detail-verhandlungsdaten">
        Verhandlungsdaten
      </KernHeading>
      <KernDescriptionList column>
        <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
      </KernDescriptionList>
    </KernStack>
  );
}

function Zeitfenster({ days }: Readonly<{ days: DayWindows[] }>) {
  return (
    <KernStack as="section" gap="sm" aria-labelledby="detail-zeitfenster" className="kern-w-full">
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
    </KernStack>
  );
}

export default function OverviewDetail() {
  const detail = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const { user, aktenzeichen, guests } = detail;
  return (
    <AppShell
      user={user}
      breadcrumbs={[{ label: "Übersicht", href: OVERVIEW_PATH }, { label: "Terminumfrage" }]}
    >
      <SidebarPage current="overview" user={user}>
        <KernStack gap="xl" align="start" className="overview-detail">
          {detail.state === "confirmed" && detail.past ? (
            <>
              <ResultBanner
                inline
                type="default"
                title={`Der Termin war am ${withDem(detail.termin)}.`}
              />
              <BackLink>Zur Übersicht</BackLink>
              <Verhandlungsdaten aktenzeichen={aktenzeichen} />
              <Guests guests={guests} canInvite={false} />
              <Zeitfenster days={detail.days} />
            </>
          ) : detail.state === "confirmed" ? (
            <>
              <ResultBanner inline type="success" title={`Der Termin ist am ${detail.termin}.`} />
              <BackLink>Zur Übersicht</BackLink>
              <Verhandlungsdaten aktenzeichen={aktenzeichen} />
              <Guests guests={guests} canInvite={false} />
              <Zeitfenster days={detail.days} />
            </>
          ) : detail.state === "open" ? (
            <OpenForReplies
              aktenzeichen={aktenzeichen}
              guests={guests}
              days={detail.days}
              selectUrl={detail.selectUrl}
              surveyUrl={detail.surveyUrl}
              notSent={result?.notSent}
            />
          ) : (
            <NoOptionWorks aktenzeichen={aktenzeichen} guests={guests} days={detail.days} />
          )}
        </KernStack>
      </SidebarPage>
    </AppShell>
  );
}

function OpenForReplies({
  aktenzeichen,
  guests,
  days,
  selectUrl,
  surveyUrl,
  notSent,
}: Readonly<{
  aktenzeichen: string;
  guests: GuestRow[];
  days: DayWindows[];
  selectUrl: string;
  surveyUrl: string;
  notSent?: string;
}>) {
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
          </>
        }
      />
      <BackLink>Zur Übersicht</BackLink>

      <SurveyLinkField id="survey-link" url={surveyUrl} />

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />
      <Guests guests={guests} canInvite notSent={notSent} />
      <Zeitfenster days={days} />
    </>
  );
}

function NoOptionWorks({
  aktenzeichen,
  guests,
  days,
}: Readonly<{ aktenzeichen: string; guests: GuestRow[]; days: DayWindows[] }>) {
  return (
    <>
      <ResultBanner
        inline
        type="warning"
        title="Es gibt leider kein Zeitfenster, dass allen Verfahrensbeteiligten passt."
        message="Starten Sie eine neue Terminumfrage."
        actions={
          <KernLinkButton to={NEW_APPOINTMENT_PATH}>
            <KernIcon name="add" />
            <KernLabel>Terminumfrage erstellen</KernLabel>
          </KernLinkButton>
        }
      />
      <BackLink>Zur Übersicht</BackLink>

      <Verhandlungsdaten aktenzeichen={aktenzeichen} />
      <Guests guests={guests} canInvite={false} />
      <Zeitfenster days={days} />
    </>
  );
}
