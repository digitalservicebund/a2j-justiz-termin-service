import { data, Link, redirect, useLoaderData } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyLinkButton } from "~/components/shared/CopyLinkButton";
import { Icon } from "~/components/shared/Icon";
import { getDb } from "~/database/database";

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

  const { origin } = new URL(request.url);
  return {
    user,
    days: groupSlotsByDay(appointment.slots.map(rangeToSlot)),
    surveyUrl: `${origin}/umfrage/${encodeURIComponent(appointment.id)}`,
  };
}

function Step({ title, children }: Readonly<{ title: string; children?: React.ReactNode }>) {
  return (
    <li className="create-termin-created__step">
      <div className="create-termin-created__step-body">
        <h3 className="kern-title create-termin-created__step-title">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export default function CreateTerminCreated() {
  const { user, days, surveyUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={createTerminBreadcrumbs}>
      <div className="create-termin-created">
        <div className="kern-alert kern-alert--success create-termin-created__banner">
          <Icon name="success" size="x-large" />
          <div className="create-termin-created__banner-body">
            <h1 className="kern-heading-large">Sie haben die Terminumfrage erstellt.</h1>
            <div className="create-termin-created__banner-actions">
              <a className="kern-btn kern-btn--primary" href="#naechste-schritte">
                <span className="kern-label">Nächste Schritte</span>
                <Icon name="arrow-down" />
              </a>
              <Link className="kern-btn kern-btn--secondary" to="/overview">
                <span className="kern-label">Zu den Terminumfragen</span>
                <Icon name="arrow-forward" />
              </Link>
            </div>
          </div>
        </div>

        <section aria-labelledby="naechste-schritte" className="create-termin-created__steps">
          <h2 className="kern-heading-large" id="naechste-schritte">
            Nächste Schritte
          </h2>
          <ol className="create-termin-created__list">
            <Step title="Halten Sie sich die vorgeschlagenen Zeitfenster frei.">
              <dl className="kern-description-list">
                {days.map(({ key, label, times }) => (
                  <div className="kern-description-list-item" key={key}>
                    <dt className="kern-description-list-item__key">{label}</dt>
                    <dd className="kern-description-list-item__value">
                      <ul className="create-termin-review__times">
                        {times.map((time) => (
                          <li key={time}>{time}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
            </Step>
            <Step title="Teilen Sie den Link zur Terminumfrage mit allen Verfahrensbeteiligten.">
              <p className="kern-body">
                Erwähnen Sie, bis wann Sie sich eine Rückmeldung wünschen.
              </p>
              <p className="kern-body create-termin-created__url">
                <Icon name="open-in-new" size="small" />
                <span>{surveyUrl}</span>
              </p>
              <CopyLinkButton url={surveyUrl} className="kern-btn--small" />
            </Step>
            <Step title="Alle Verfahrensbeteiligten geben Ihre Verfügbarkeiten an." />
            <Step title="Wählen Sie einen passenden Termin aus." />
            <Step title="Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den ausgewählten Termin." />
            <Step title="Die Servicestelle verschickt die Ladung." />
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
