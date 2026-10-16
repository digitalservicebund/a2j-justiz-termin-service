import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";

import { getSessionUser } from "~/adapters/session/session";
import Alert from "~/components/shared/Alert";
import { BmjvLogo } from "~/components/shared/BmjvLogo";
import { Breadcrumb } from "~/components/shared/Breadcrumb";
import { Button } from "~/components/shared/Button";
import { Icon, type IconName } from "~/components/shared/Icon";
import { KernKopfZeile } from "~/components/shared/KernKopfZeile";
import { LoginForm } from "~/components/shared/LoginForm";
import { getAuth } from "~/lib/auth.server";
import { logError } from "~/lib/logging";

import "./welcome.css";

export async function loader({ request }: { request: Request }) {
  if (await getSessionUser(request)) return redirect("/home");
  return { invalidLink: new URL(request.url).searchParams.has("error") };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  if (formData.get("intent") === "logout") {
    const response = await getAuth().handler(
      new Request(new URL("/api/auth/sign-out", request.url), {
        method: "POST",
        headers: request.headers,
      }),
    );
    if (!response.ok) return response;
    const headers = new Headers();
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    return redirect("/", { headers });
  }
  const result = z.string().trim().toLowerCase().pipe(z.email()).safeParse(formData.get("email"));
  if (!result.success) {
    return data({ error: "Bitte geben Sie eine gültige E-Mail-Adresse ein." }, { status: 400 });
  }
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");
  const response = await getAuth().handler(
    new Request(new URL("/api/auth/sign-in/magic-link", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: result.data,
        callbackURL: "/home",
        errorCallbackURL: "/",
      }),
    }),
  );
  if (!response.ok) {
    logError(`Magic-link request failed with status ${response.status}`);
    return data(
      { error: "Die Anmeldung ist derzeit nicht möglich. Bitte versuchen Sie es später erneut." },
      { status: response.status },
    );
  }
  return data({ sent: true });
}

const steps: Array<{ icon: IconName; label: string }> = [
  { icon: "calendar-today", label: "Richterschaft erstellt die Terminumfrage" },
  { icon: "checklist", label: "Verfahrensbeteiligte teilen ihre Verfügbarkeit" },
  { icon: "success", label: "Richterschaft wählt einen passenden Termin aus" },
  { icon: "mail", label: "Eine passende Ladung wird verschickt" },
];

// Targets for these links are not defined in the design yet.
const TODO_HREF = "#";

const legalLinks = [
  { href: TODO_HREF, label: "Impressum" },
  { href: TODO_HREF, label: "Barrierefreiheit" },
  { href: TODO_HREF, label: "Datenschutz" },
];

const contactLinks = [
  { href: TODO_HREF, label: "Kontakt" },
  {
    href: "https://github.com/digitalservicebund/a2j-justiz-termin-service",
    label: "Open Source Code",
  },
  { href: TODO_HREF, label: "An Befragungen teilnehmen" },
];

const pilotLinks = [
  {
    href: "https://www.bmj.de",
    label: "Bundesministeriums der Justiz und für Verbraucherschutz",
  },
];

const operatorLinks = [
  {
    href: "https://digitalservice.bund.de",
    label: "DigitalService GmbH des Bundes",
  },
  {
    href: "https://zugang-zum-recht-projekte.de",
    label: "zugang-zum-recht-projekte.de",
  },
];

function ExternalLinkList({ links }: Readonly<{ links: Array<{ href: string; label: string }> }>) {
  return (
    <ul className="welcome__link-list">
      {links.map(({ href, label }) => (
        <li key={label}>
          <a className="kern-link" href={href} target="_blank" rel="noreferrer">
            <Icon name="open-in-new" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Welcome() {
  const { invalidLink } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <div className="welcome">
      <KernKopfZeile />

      <header className="welcome__header">
        <div className="kern-container">
          <p className="kern-heading-large welcome__service-name">Justiz-Services</p>
        </div>
      </header>

      <main>
        <section className="welcome__hero">
          <div className="kern-container">
            <Breadcrumb
              items={[
                { label: "Startseite", href: "/", icon: "home" },
                { label: "Gerichtstermin-Finder" },
              ]}
            />

            <div className="welcome__hero-content">
              <h1 className="kern-heading-x-large">Gerichtstermin-Finder</h1>
              <p className="kern-body kern-body--large kern-body--bold">
                Der Gerichtstermin-Finder vereinfacht die Terminkoordination zwischen Gericht und
                Verfahrensbeteiligten.
              </p>
              {invalidLink && (
                <Alert
                  type="error"
                  title="Ungültiger Anmeldelink"
                  message="Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an."
                />
              )}
              {result && "error" in result && (
                <Alert type="error" title="Anmeldung nicht möglich" message={result.error} />
              )}
              {result && "sent" in result && (
                <Alert
                  type="success"
                  title="Bitte prüfen Sie Ihr Postfach"
                  message="Wenn Ihre E-Mail-Adresse hinterlegt ist, erhalten Sie einen Anmeldelink. Er ist 5 Minuten gültig."
                />
              )}
              <LoginForm />
            </div>
          </div>
        </section>

        <section className="welcome__pilot">
          <div className="welcome__content">
            <details className="kern-details">
              <summary className="kern-details__header welcome__pilot-summary">
                Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)
              </summary>
              <p className="kern-body">
                Dieser Dienst wird derzeit gemeinsam mit Nutzenden erprobt. Funktionen und Inhalte
                können sich noch ändern.
              </p>
            </details>
          </div>
        </section>

        <div className="welcome__content welcome__sections">
          <section aria-labelledby="welcome-ablauf">
            <h2 className="kern-heading-large" id="welcome-ablauf">
              Der Ablauf
            </h2>
            <ol className="welcome__steps">
              {steps.map(({ icon, label }) => (
                <li key={label} className="welcome__step">
                  <Icon name={icon} size="x-large" />
                  <span className="kern-title">{label}</span>
                </li>
              ))}
            </ol>
          </section>

          <Alert type="info" title="Gestalten Sie die digitalen Angebote der Justiz mit">
            <p className="kern-body">
              Wir wollen digitale Justiz-Angebote entwickeln, die für alle Menschen gut
              funktionieren. Ihre Hilfe ist dabei sehr wichtig. In kurzen Online-Gesprächen können
              Sie Ihre Erfahrungen mit uns teilen und neue Services testen.
            </p>
            <a className="kern-link" href={TODO_HREF}>
              <Icon name="arrow-forward" size="small" />
              Jetzt für die Teilnahme anmelden
            </a>
          </Alert>

          <section aria-labelledby="welcome-feedback" className="welcome__feedback">
            <h2 className="kern-title kern-title--small" id="welcome-feedback">
              Hat Ihnen diese Seite geholfen?
            </h2>
            <div className="welcome__feedback-actions">
              <Button type="button" style="secondary">
                Ja
              </Button>
              <Button type="button" style="secondary">
                Nein
              </Button>
            </div>
          </section>
        </div>

        <div className="welcome__content welcome__report">
          <Button type="button" style="secondary">
            <Icon name="danger" />
            <span className="kern-label">Problem mit dieser Seite melden</span>
          </Button>
        </div>
      </main>

      <footer className="welcome__footer">
        <div className="kern-container welcome__footer-grid">
          <div className="welcome__footer-brand">
            <p className="kern-heading-medium">Gerichtstermin-Finder</p>
            <p className="kern-body kern-body--muted">Onlinedienste der Justiz</p>
          </div>

          <div className="welcome__footer-logo">
            <BmjvLogo />
          </div>

          <nav aria-labelledby="footer-legal" className="welcome__footer-legal">
            <h2 className="kern-title kern-title--small" id="footer-legal">
              Rechtliche Hinweise
            </h2>
            <ul className="welcome__link-list">
              {legalLinks.map(({ href, label }) => (
                <li key={label}>
                  <a className="kern-link" href={href}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-contact" className="welcome__footer-contact">
            <h2 className="kern-title kern-title--small" id="footer-contact">
              Kontakt und Teilnahme
            </h2>
            <ul className="welcome__link-list">
              {contactLinks.map(({ href, label }) => (
                <li key={label}>
                  <a className="kern-link" href={href}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="welcome__footer-pilot">
            <h2 className="kern-title kern-title--small">Ein Pilotprojekt des</h2>
            <ExternalLinkList links={pilotLinks} />
          </div>

          <div className="welcome__footer-operator">
            <h2 className="kern-title kern-title--small">Umsetzung und Betrieb</h2>
            <ExternalLinkList links={operatorLinks} />
          </div>
        </div>
      </footer>

      <div className="welcome__unapproved">
        <Button type="button" style="secondary">
          <span className="kern-label">Nicht freigegebene E-Mail-Adresse</span>
          <Icon name="arrow-forward" />
        </Button>
      </div>
    </div>
  );
}
