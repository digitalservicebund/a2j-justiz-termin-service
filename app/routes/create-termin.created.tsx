import { data, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyLinkButton } from "~/components/shared/CopyLinkButton";
import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { getDb } from "~/database/database";
import { BASE_PATH } from "~/lib/base-path";

import { createTerminBreadcrumbs, groupSlotsByDay } from "./create-termin.review";
import { rangeToSlot } from "./create-termin.slots";

import "./create-termin.created.css";

type Params = { params: { appointmentId?: string } };

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw data("Not found", { status: 404 });
  // A draft has not been published yet, so there is nothing to share.
  if (appointment.status === "draft") throw redirect(`/overview/${encodeURIComponent(id)}/confirm`);

  // Published appointments always have their token.
  if (!appointment.universalToken) throw data("Not found", { status: 404 });

  const { origin } = new URL(request.url);
  return {
    user,
    days: groupSlotsByDay(appointment.slots.map(rangeToSlot)),
    surveyUrl: `${origin}${BASE_PATH}/umfrage/${encodeURIComponent(appointment.universalToken)}`,
  };
}

export function Step({ title, children }: Readonly<{ title: string; children?: React.ReactNode }>) {
  return (
    <li className="create-termin-created__step">
      <div className="create-termin-created__step-body">
        <KernHeading size="title" level={3} className="create-termin-created__step-title">
          {title}
        </KernHeading>
        {children}
      </div>
    </li>
  );
}

// Success banner and the numbered steps that follow, shared with the page after choosing a Termin.
// The link back to the judge's overview is left out for guests, who have no overview.
export function SuccessBanner({
  title,
  overviewLink = true,
}: Readonly<{ title: string; overviewLink?: boolean }>) {
  return (
    <ResultBanner
      type="success"
      title={title}
      actions={
        <>
          <a className="kern-btn kern-btn--primary" href="#naechste-schritte">
            <KernLabel>Nächste Schritte</KernLabel>
            <KernIcon name="arrow-down" />
          </a>
          {overviewLink && (
            <KernLinkButton style="secondary" to="/overview">
              <KernLabel>Zu den Terminumfragen</KernLabel>
              <KernIcon name="arrow-forward" />
            </KernLinkButton>
          )}
        </>
      }
    />
  );
}

export function NextSteps({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DefaultPage>
      <section className="create-termin-created__steps" aria-labelledby="naechste-schritte">
        <KernHeading size="large" level={2} id="naechste-schritte">
          Nächste Schritte
        </KernHeading>
        <ol className="create-termin-created__list">{children}</ol>
      </section>
    </DefaultPage>
  );
}

export default function CreateTerminCreated() {
  const { user, days, surveyUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <div className="create-termin-created">
        <SuccessBanner title="Sie haben die Terminumfrage erstellt." />

        <NextSteps>
          <Step title="Halten Sie sich die vorgeschlagenen Zeitfenster frei.">
            <KernDescriptionList>
              {days.map(({ key, label, times }) => (
                <KernDescriptionListItem key={key} label={label}>
                  <ul className="create-termin-review__times">
                    {times.map((time) => (
                      <li key={time}>{time}</li>
                    ))}
                  </ul>
                </KernDescriptionListItem>
              ))}
            </KernDescriptionList>
          </Step>
          <Step title="Teilen Sie den Link zur Terminumfrage mit allen Verfahrensbeteiligten.">
            <KernBody>Erwähnen Sie, bis wann Sie sich eine Rückmeldung wünschen.</KernBody>
            <KernBody className="create-termin-created__url">
              <KernIcon name="open-in-new" size="small" />
              <span>{surveyUrl}</span>
            </KernBody>
            <CopyLinkButton url={surveyUrl} className="kern-btn--small" />
          </Step>
          <Step title="Alle Verfahrensbeteiligten geben Ihre Verfügbarkeiten an." />
          <Step title="Wählen Sie einen passenden Termin aus." />
          <Step title="Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den ausgewählten Termin." />
          <Step title="Die Servicestelle verschickt die Ladung." />
        </NextSteps>
      </div>
    </AppShell>
  );
}
