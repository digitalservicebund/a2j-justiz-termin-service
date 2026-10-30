import type { ReactNode } from "react";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";

import { getSessionUser } from "~/adapters/session/session";
import { canSignIn } from "~/adapters/users/users.server";
import { A2JIcon } from "~/components/shared/a2j/A2JIcon";
import { A2JInlineNotice } from "~/components/shared/a2j/A2JInlineNotice";
import { AppShell } from "~/components/shared/AppShell";
import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { LoginForm } from "~/components/shared/LoginForm";
import { getDb } from "~/database/database";
import { getAuth } from "~/lib/auth.server";
import { AUTH_BASE_PATH, BASE_PATH } from "~/lib/base-path";
import { logError } from "~/lib/logging";

import "./welcome.css";

export async function loader({ request }: { request: Request }) {
  const user = await getSessionUser(request);
  return { user, invalidLink: new URL(request.url).searchParams.has("error") };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  if (formData.get("intent") === "logout") {
    const response = await getAuth().handler(
      new Request(new URL(`${AUTH_BASE_PATH}/sign-out`, request.url), {
        method: "POST",
        headers: request.headers,
      }),
    );
    if (!response.ok) return response;
    const headers = new Headers();
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    return redirect("/", { headers });
  }
  const submitted = String(formData.get("email") ?? "");
  const result = z.string().trim().toLowerCase().pipe(z.email()).safeParse(submitted);
  if (!result.success) return data({ invalidEmail: true, email: submitted }, { status: 400 });
  if (!(await canSignIn(getDb(), result.data))) {
    return data({ notAllowed: true, email: submitted }, { status: 403 });
  }
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");
  const response = await getAuth().handler(
    new Request(new URL(`${AUTH_BASE_PATH}/sign-in/magic-link`, request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: result.data,
        callbackURL: `${BASE_PATH}/overview`,
        errorCallbackURL: `${BASE_PATH}/`,
      }),
    }),
  );
  if (!response.ok) {
    logError(`Magic-link request failed with status ${response.status}`);
    return data(
      {
        error: "Die Anmeldung ist derzeit nicht möglich. Bitte versuchen Sie es später erneut.",
        email: submitted,
      },
      { status: response.status },
    );
  }
  return data({ sent: true, email: submitted });
}

const steps: Array<{ icon: ReactNode; label: string }> = [
  {
    icon: <A2JIcon name="add-box" size="x-large" />,
    label: "Das Gericht erstellt die Terminumfrage",
  },
  {
    icon: <A2JIcon name="checklist-rtl" size="x-large" />,
    label: "Verfahrensbeteiligte teilen ihre Verfügbarkeit",
  },
  {
    icon: <A2JIcon name="event" size="x-large" />,
    label: "Das Gericht wählt einen passenden Termin aus",
  },
  {
    icon: <KernIcon name="mail" size="x-large" />,
    label: "Die Servicestelle verschickt die Ladung",
  },
];

const CONTACT_EMAIL = "a2j-jts@digitalservice.bund.de";

// Target for this link is not defined in the design yet.
const TODO_HREF = "#";

export default function Welcome() {
  const { user, invalidLink } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AppShell
      className="welcome"
      user={user ?? undefined}
      showReportProblem={false}
      breadcrumbs={[]}
    >
      <section className="welcome__hero">
        <DefaultPage>
          <div className="welcome__hero-content">
            <KernHeading size="x-large" level={1}>
              Verhandlungstermin-Finder
            </KernHeading>
            <KernBody size="large" bold>
              Der Verhandlungstermin-Finder vereinfacht die Terminkoordination zwischen Gericht und
              Verfahrensbeteiligten.
            </KernBody>
            {user ? (
              <div>
                <KernLinkButton to="/overview">
                  <KernLabel>Verhandlungstermin-Finder</KernLabel>
                  <KernIcon name="arrow-forward" />
                </KernLinkButton>
              </div>
            ) : (
              <>
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
                <LoginForm
                  email={result?.email}
                  sent={result !== undefined && "sent" in result}
                  error={
                    result && "invalidEmail" in result ? (
                      "Bitte geben Sie eine gültige E‑Mail-Adresse ein."
                    ) : result && "notAllowed" in result ? (
                      <>
                        Während der Pilotierung können nur ausgewählte Gerichte den Onlinedienst
                        nutzen. Melden Sie sich bei Interesse unter: <br />
                        <a className="kern-link" href={`mailto:${CONTACT_EMAIL}`}>
                          {CONTACT_EMAIL}
                        </a>
                      </>
                    ) : undefined
                  }
                />
              </>
            )}
          </div>
        </DefaultPage>
      </section>

      <section className="welcome__pilot">
        <DefaultPage>
          <details className="kern-details">
            <summary className="kern-details__header welcome__pilot-summary">
              Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)
            </summary>
            <KernBody>
              Mit diesem Projekt wird ein Onlinedienst für die Terminabstimmung zwischen Gerichten
              und Verfahrensbeteiligten erprobt. Die Erstellung einer Terminumfrage ist noch nicht
              für alle Gerichte möglich. Verfahrensbeteiligte können den Onlinedienst aktuell nur
              auf Einladung nutzen.
            </KernBody>
          </details>
        </DefaultPage>
      </section>

      <DefaultPage>
        <div className="welcome__sections">
          <section aria-labelledby="welcome-ablauf">
            <KernHeading size="large" level={2} id="welcome-ablauf">
              Der Ablauf
            </KernHeading>
            <ol className="welcome__steps">
              {steps.map(({ icon, label }) => (
                <li key={label} className="welcome__step">
                  {icon}
                  <span className="kern-title">{label}</span>
                </li>
              ))}
            </ol>
          </section>

          <A2JInlineNotice
            type="information"
            title="Gestalten Sie die digitalen Angebote der Justiz mit"
            link={{ href: TODO_HREF, label: "Jetzt für die Teilnahme anmelden" }}
          >
            Wir wollen digitale Justiz-Angebote entwickeln, die für alle Menschen gut funktionieren.
            Ihre Hilfe ist dabei sehr wichtig. In kurzen Online-Gesprächen können Sie Ihre
            Erfahrungen mit uns teilen und neue Services testen.
          </A2JInlineNotice>
        </div>
      </DefaultPage>
    </AppShell>
  );
}
