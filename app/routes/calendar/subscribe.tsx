import { useLoaderData } from "react-router";

import { readCalendarToken } from "~/adapters/appointments/calendar-feed.server";
import { requireUser } from "~/adapters/session/session";
import { A2JIcon } from "~/components/shared/a2j/A2JIcon";
import { AppShell } from "~/components/shared/AppShell";
import { CopyButton } from "~/components/shared/CopyButton";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLink } from "~/components/shared/kern/KernLink";
import { KernStack } from "~/components/shared/kern/KernStack";
import { Step } from "~/components/shared/NextSteps";
import { SidebarPage } from "~/components/shared/SidebarPage";
import { getDb } from "~/database/database";
import { calendarFeedPath } from "~/lib/calendar/calendar-feed";
import { requireEnv } from "~/lib/infra/env";
import { OPENED_IN_BROWSER_PARAM } from "~/lib/web/paths";

import "~/components/shared/NextSteps.css";
import "./subscribe.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const token = await readCalendarToken(getDb(), user.id);
  if (!token) throw new Response("Not Found", { status: 404 });
  const feedUrl = `${requireEnv("BASE_URL")}${calendarFeedPath(token)}`;
  // Calendar apps register the feed when they open an address with the webcal scheme.
  return {
    user,
    feedUrl,
    webcalUrl: feedUrl.replace(/^https?:/, "webcal:"),
    // Set when the feed sent a browser here that opened the calendar link itself.
    openedInBrowser: new URL(request.url).searchParams.has(OPENED_IN_BROWSER_PARAM),
  };
}

// The steps after the first one, which copies the link and is the same for every app.
const guides = [
  {
    app: "Outlook",
    steps: [
      "Öffnen Sie Ihren Outlook-Kalender und wählen Sie „Kalender hinzufügen“.",
      "Wählen Sie „Aus dem Internet abonnieren“.",
      "Fügen Sie den Kalender-Link ein.",
      "Geben Sie dem Kalender einen Namen wie zum Beispiel „Verhandlungstermin-Finder“ und klicken Sie auf „Importieren“.",
    ],
    help: "https://support.microsoft.com/de-de/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web",
  },
  {
    app: "Apple",
    steps: [
      "Öffnen Sie die Kalender-App und wählen Sie im Menü die Option „Ablage“, und klicken Sie dann auf „Neues Kalender-Abonnement“.",
      "Fügen Sie den Kalender-Link ein, und klicken Sie anschließend auf „Abonnieren“.",
      "Wählen Sie bei der Option „Automatisch aktualisieren“ „Alle 5 Minuten“ aus.",
      "Klicken Sie abschließend auf „OK“.",
    ],
    help: "https://support.apple.com/de-de/guide/calendar/icl1022/mac",
  },
  {
    app: "Google",
    steps: [
      "Öffnen Sie Google Kalender, klicken Sie neben „Weitere Kalender“ auf das Plus-Symbol und wählen Sie dann „Per URL“.",
      "Fügen Sie den Kalender-Link ein und klicken Sie auf „Kalender hinzufügen“.",
    ],
    help: "https://support.google.com/calendar/answer/37100?hl=de",
  },
];

function CopyLinkStep({ feedUrl }: Readonly<{ feedUrl: string }>) {
  return (
    <Step title="Kopieren Sie den Kalender-Link." level={4}>
      <CopyButton
        text={feedUrl}
        label="Kalender-Link kopieren"
        copiedLabel="Kalender-Link kopiert"
        announcement="Der Kalender-Link wurde kopiert."
        className="kern-btn--small"
        icon={<A2JIcon name="link" size="small" />}
      />
      {/* Shown in full, so it can be selected and copied by hand, also without JavaScript. */}
      <KernLink href={feedUrl} className="calendar-subscribe__feed-link">
        <KernIcon name="open-in-new" />
        {feedUrl}
      </KernLink>
    </Step>
  );
}

export default function CalendarSubscribe() {
  const { user, feedUrl, webcalUrl, openedInBrowser } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={[{ label: "Kalender abonnieren" }]}>
      <SidebarPage current="calendar" user={user}>
        <KernStack gap="xl" className="calendar-subscribe">
          {openedInBrowser && (
            <KernAlert type="warning" title="Kalender-Links werden vom Browser nicht unterstützt.">
              <KernBody className="kern-m-none">
                Folgen Sie der Anleitung, um den Kalender zu abonnieren.
              </KernBody>
              <KernLink href="#anleitung" className="calendar-subscribe__icon-link">
                <KernIcon name="arrow-forward" />
                Zur Anleitung
              </KernLink>
            </KernAlert>
          )}

          <KernStack gap="md" align="start">
            <KernHeading size="x-large" level={1}>
              Automatisch aktuelle Zeitfenster und Termine im Kalender anzeigen lassen
            </KernHeading>
            <KernBody size="large">
              Sie können den Kalender vom Verhandlungstermin-Finder mit allen vorgeschlagenen
              Zeitfenstern und Terminen abonnieren.
            </KernBody>
            <section aria-labelledby="vorteile">
              <KernHeading size="medium" level={2} id="vorteile">
                Vorteile
              </KernHeading>
              <ul className="kern-body kern-body--large calendar-subscribe__benefits">
                <li>
                  Ihre blockierten Zeitfenster und Termine werden automatisch hinzugefügt und
                  aktualisiert
                </li>
                <li>Nicht mehr relevante Zeitfenster werden entfernt</li>
                <li>Sie vermeiden Doppelbuchungen</li>
                <li>Kompatibel mit den gängigen Kalender-Apps</li>
              </ul>
            </section>
            <a className="kern-btn kern-btn--primary" href={webcalUrl}>
              <KernIcon name="open-in-new" />
              <KernLabel>Kalender in Kalender-App abonnieren</KernLabel>
            </a>
          </KernStack>

          <section aria-labelledby="anleitung" className="calendar-subscribe__howto">
            <KernHeading size="large" level={2} id="anleitung" tabIndex={-1}>
              So abonnieren Sie den Kalender manuell auf Ihrem Computer
            </KernHeading>
            <div className="calendar-subscribe__guides">
              {guides.map(({ app, steps, help }) => (
                <details className="kern-accordion" key={app}>
                  <summary className="kern-accordion__header">
                    <KernHeading size="title" level={3}>
                      {app}
                    </KernHeading>
                  </summary>
                  <div className="kern-accordion__body">
                    <KernStack as="ol" className="next-steps__list calendar-subscribe__steps">
                      <CopyLinkStep feedUrl={feedUrl} />
                      {steps.map((step) => (
                        <Step key={step} title={step} level={4} />
                      ))}
                    </KernStack>
                    <KernBody className="kern-m-none">
                      Hier finden Sie die offizielle{" "}
                      <KernLink href={help} target="_blank" rel="noreferrer">
                        Anleitung<span className="kern-sr-only"> (öffnet in neuem Fenster)</span>
                      </KernLink>{" "}
                      von {app}.
                    </KernBody>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </KernStack>
      </SidebarPage>
    </AppShell>
  );
}
