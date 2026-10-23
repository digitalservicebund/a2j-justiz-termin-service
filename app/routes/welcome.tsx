import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";

import { getSessionUser } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
import { LoginForm } from "~/components/shared/LoginForm";
import { getAuth } from "~/lib/auth.server";
import { logError } from "~/lib/logging";

import "./welcome.css";

export async function loader({ request }: { request: Request }) {
  if (await getSessionUser(request)) return redirect("/overview");
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
        callbackURL: "/overview",
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

const steps: Array<{ icon: KernIconName; label: string }> = [
  { icon: "calendar-today", label: "Richterschaft erstellt die Terminumfrage" },
  { icon: "checklist", label: "Verfahrensbeteiligte teilen ihre Verfügbarkeit" },
  { icon: "success", label: "Richterschaft wählt einen passenden Termin aus" },
  { icon: "mail", label: "Eine passende Ladung wird verschickt" },
];

// Target for this link is not defined in the design yet.
const TODO_HREF = "#";

export default function Welcome() {
  const { invalidLink } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppShell
      className="welcome"
      breadcrumbs={[
        { label: "Startseite", href: "/", icon: "home" },
        { label: "Verhandlungstermin-Finder" },
      ]}
    >
      <section className="welcome__hero">
        <div className="welcome__hero-content">
          <KernHeading size="x-large" level={1}>
            Verhandlungstermin-Finder
          </KernHeading>
          <KernBody size="large" bold>
            Der Verhandlungstermin-Finder vereinfacht die Terminkoordination zwischen Gericht und
            Verfahrensbeteiligten.
          </KernBody>
          {invalidLink && (
            <KernAlert
              type="error"
              title="Ungültiger Anmeldelink"
              message="Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an."
            />
          )}
          {result && "error" in result && (
            <KernAlert type="error" title="Anmeldung nicht möglich" message={result.error} />
          )}
          {result && "sent" in result && (
            <KernAlert
              type="success"
              title="Bitte prüfen Sie Ihr Postfach"
              message="Wenn Ihre E-Mail-Adresse hinterlegt ist, erhalten Sie einen Anmeldelink. Er ist 5 Minuten gültig."
            />
          )}
          <LoginForm />
        </div>
      </section>

      <section className="welcome__pilot">
        <div className="welcome__content">
          <details className="kern-details">
            <summary className="kern-details__header welcome__pilot-summary">
              Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)
            </summary>
            <KernBody>
              Dieser Dienst wird derzeit gemeinsam mit Nutzenden erprobt. Funktionen und Inhalte
              können sich noch ändern.
            </KernBody>
          </details>
        </div>
      </section>

      <div className="welcome__content welcome__sections">
        <section aria-labelledby="welcome-ablauf">
          <KernHeading size="large" level={2} id="welcome-ablauf">
            Der Ablauf
          </KernHeading>
          <ol className="welcome__steps">
            {steps.map(({ icon, label }) => (
              <li key={label} className="welcome__step">
                <KernIcon name={icon} size="x-large" />
                <span className="kern-title">{label}</span>
              </li>
            ))}
          </ol>
        </section>

        <KernAlert type="info" title="Gestalten Sie die digitalen Angebote der Justiz mit">
          <KernBody>
            Wir wollen digitale Justiz-Angebote entwickeln, die für alle Menschen gut funktionieren.
            Ihre Hilfe ist dabei sehr wichtig. In kurzen Online-Gesprächen können Sie Ihre
            Erfahrungen mit uns teilen und neue Services testen.
          </KernBody>
          <a className="kern-link" href={TODO_HREF}>
            <KernIcon name="arrow-forward" size="small" />
            Jetzt für die Teilnahme anmelden
          </a>
        </KernAlert>

        <section aria-labelledby="welcome-feedback" className="welcome__feedback">
          <KernHeading size="title-small" level={2} id="welcome-feedback">
            Hat Ihnen diese Seite geholfen?
          </KernHeading>
          <div className="welcome__feedback-actions">
            <KernButton type="button" style="secondary">
              Ja
            </KernButton>
            <KernButton type="button" style="secondary">
              Nein
            </KernButton>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
