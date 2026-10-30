import { useLoaderData } from "react-router";

import { readCalendarToken } from "~/adapters/appointments/calendar-feed.server";
import { requireUser } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { CopyButton } from "~/components/shared/CopyButton";
import { DefaultPage, PageSection } from "~/components/shared/DefaultPage";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLink } from "~/components/shared/kern/KernLink";
import { MainNav } from "~/components/shared/MainNav";
import { getDb } from "~/database/database";
import { calendarFeedPath } from "~/lib/calendar-feed";
import { requireEnv } from "~/lib/env";

import "./calendar-subscribe.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request);
  const token = await readCalendarToken(getDb(), user.id);
  if (!token) throw new Response("Not Found", { status: 404 });
  const feedUrl = `${requireEnv("BASE_URL")}${calendarFeedPath(token)}`;
  // Calendar apps register the feed when they open an address with the webcal scheme.
  return { user, feedUrl, webcalUrl: feedUrl.replace(/^https?:/, "webcal:") };
}

const instructions = [
  {
    app: "Outlook",
    steps: [
      "Öffnen Sie den Kalender und wählen Sie „Kalender hinzufügen“.",
      "Wählen Sie „Aus dem Internet abonnieren“.",
      "Fügen Sie den kopierten Link ein, vergeben Sie einen Namen und bestätigen Sie mit „Importieren“.",
    ],
  },
  {
    app: "Apple Kalender",
    steps: [
      "Wählen Sie im Menü „Ablage“ den Eintrag „Neues Kalenderabonnement“.",
      "Fügen Sie den kopierten Link ein und klicken Sie auf „Abonnieren“.",
      "Stellen Sie unter „Automatisch aktualisieren“ ein, wie oft der Kalender abgeglichen wird.",
    ],
  },
  {
    app: "Google Kalender",
    steps: [
      "Klicken Sie links neben „Weitere Kalender“ auf das Plus und wählen Sie „Per URL“.",
      "Fügen Sie den kopierten Link ein und klicken Sie auf „Kalender hinzufügen“.",
      "Google Kalender gleicht abonnierte Kalender nur alle paar Stunden ab. Änderungen erscheinen dort verzögert.",
    ],
  },
];

export default function CalendarSubscribe() {
  const { user, feedUrl, webcalUrl } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={[{ label: "Kalender abonnieren" }]}>
      <PageSection width="wide">
        <div className="calendar-subscribe">
          <MainNav current="calendar" />
          <DefaultPage width="content">
            <div className="calendar-subscribe__content">
              <KernHeading size="large" level={1}>
                Kalender abonnieren
              </KernHeading>
              <KernBody>
                Abonnieren Sie Ihre Terminumfragen in Ihrer Kalender-App. Zeitfenster von offenen
                Terminumfragen erscheinen dort als vorläufige Einträge, bestätigte Termine als feste
                Einträge. Ihre Kalender-App gleicht den Kalender regelmäßig ab.
              </KernBody>

              <section aria-labelledby="calendar-link" className="calendar-subscribe__section">
                <KernHeading size="medium" level={2} id="calendar-link">
                  Ihr Kalenderlink
                </KernHeading>
                <KernFormInput
                  id="calendar-feed-url"
                  label="Link zum Kalender"
                  readOnly
                  value={feedUrl}
                  wrapperClassName="calendar-subscribe__field"
                />
                <KernBody size="small" muted>
                  Der Link ist persönlich. Geben Sie ihn nicht weiter: Wer ihn kennt, sieht Ihre
                  Termine.
                </KernBody>
                <div className="calendar-subscribe__actions">
                  <CopyButton
                    text={feedUrl}
                    label="Link kopieren"
                    copiedLabel="Link kopiert"
                    announcement="Der Link zum Kalender wurde kopiert."
                  />
                  <KernLink href={webcalUrl}>
                    <KernIcon name="open-in-new" size="small" />
                    <KernLabel>In Kalender-App öffnen</KernLabel>
                  </KernLink>
                </div>
              </section>

              <section aria-labelledby="calendar-howto" className="calendar-subscribe__section">
                <KernHeading size="medium" level={2} id="calendar-howto">
                  So abonnieren Sie den Kalender
                </KernHeading>
                {instructions.map(({ app, steps }) => (
                  <details className="kern-accordion" key={app}>
                    <summary className="kern-accordion__header">
                      <KernHeading size="title" level={3}>
                        {app}
                      </KernHeading>
                    </summary>
                    <div className="kern-accordion__body">
                      <ol>
                        {steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </details>
                ))}
              </section>
            </div>
          </DefaultPage>
        </div>
      </PageSection>
    </AppShell>
  );
}
