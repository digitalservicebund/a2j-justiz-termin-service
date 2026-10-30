import type { ReactNode } from "react";
import { Form, Link as RouterLink, useRouteLoaderData } from "react-router";

import type { AuthUser } from "~/core/domain/user";

import { BmjvLogo } from "./BmjvLogo";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { DefaultPage, type PageWidth } from "./DefaultPage";
import { contactLinks, legalLinks, operatorLinks, pilotLinks, type Link } from "./footer-links";
import { KernBody } from "./kern/KernBody";
import { KernButton } from "./kern/KernButton";
import { KernHeading } from "./kern/KernHeading";
import { KernIcon, type KernIconName } from "./kern/KernIcon";
import { KernKopfZeile } from "./kern/KernKopfZeile";
import { KernLabel } from "./kern/KernLabel";
import { KernLink } from "./kern/KernLink";

import "./AppShell.css";

const languageLinks: Array<Link & { icon: KernIconName }> = [
  {
    href: "https://service.justiz.de/leichtesprache",
    label: "Leichte Sprache",
    icon: "easy-language",
  },
  {
    href: "https://service.justiz.de/gebaerdensprache",
    label: "Gebärdensprache",
    icon: "sign-language",
  },
];

function LinkList({ links }: Readonly<{ links: Link[] }>) {
  return (
    <ul className="page-shell__link-list">
      {links.map(({ href, label }) => (
        <li key={label}>
          <a className="kern-link" href={href}>
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ExternalLinkList({ links }: Readonly<{ links: Link[] }>) {
  return (
    <ul className="page-shell__link-list">
      {links.map(({ href, label }) => (
        <li key={label}>
          <a className="kern-link" href={href} target="_blank" rel="noreferrer">
            <KernIcon name="open-in-new" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

type AppShellProps = {
  // The crumbs below the fixed ones; an empty list on the front page. No breadcrumb if omitted.
  breadcrumbs?: BreadcrumbItem[];
  user?: AuthUser;
  className?: string;
  showReportProblem?: boolean;
  // The width the report-problem button is aligned to, to match the page content above it.
  reportProblemWidth?: PageWidth;
  // The easy-language and sign-language links are only shown on the front page.
  showLanguageLinks?: boolean;
  children: ReactNode;
};

export function AppShell({
  breadcrumbs,
  user: userProp,
  className,
  showReportProblem = true,
  reportProblemWidth,
  showLanguageLinks = false,
  children,
}: Readonly<AppShellProps>) {
  // Pages can pass the user themselves; otherwise it comes from the root loader. The root loader
  // is missing when it failed, as on the error page.
  const rootData = useRouteLoaderData<{ user: AuthUser | null }>("root");
  const user = userProp ?? rootData?.user ?? undefined;
  const classes = ["page-shell", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <KernKopfZeile />

      <header className="page-shell__header">
        <div className="kern-container page-shell__header-inner">
          <KernHeading size="large" className="page-shell__service-name">
            <RouterLink to="/" className="page-shell__service-link">
              Justiz-Services
            </RouterLink>
          </KernHeading>
          <div className="page-shell__header-actions">
            {showLanguageLinks && (
              <nav aria-label="Sprachangebote">
                <ul className="page-shell__language-links">
                  {languageLinks.map(({ href, label, icon }) => (
                    <li key={label}>
                      <KernLink size="small" href={href}>
                        <KernIcon name={icon} />
                        {label}
                      </KernLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {user && (
              <div className="page-shell__user">
                <KernBody muted className="page-shell__user-info">
                  <KernIcon name="account-circle" />
                  <span>Angemeldet als:</span>
                  <span>{user.email}</span>
                </KernBody>
                {/* reloadDocument: with a basename React Router drops the `?index` of this action
                    during a client-side submit and posts to the current route instead. */}
                <Form method="post" action="/?index" reloadDocument>
                  <input type="hidden" name="intent" value="logout" />
                  <button type="submit" className="kern-link kern-link--small page-shell__logout">
                    <KernIcon name="logout" />
                    Abmelden
                  </button>
                </Form>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {breadcrumbs && (
          <div className="page-shell__breadcrumbs">
            <div className="kern-container">
              <Breadcrumb items={breadcrumbs} />
            </div>
          </div>
        )}

        {children}

        {showReportProblem && (
          <DefaultPage width={reportProblemWidth}>
            <div className="page-shell__report">
              <KernButton type="button" style="secondary">
                <KernIcon name="danger" />
                <KernLabel>Problem mit dieser Seite melden</KernLabel>
              </KernButton>
            </div>
          </DefaultPage>
        )}
      </main>

      <footer className="page-shell__footer">
        <div className="kern-container page-shell__footer-grid">
          <div className="page-shell__footer-brand">
            <KernHeading size="medium">Justiz-Services</KernHeading>
            <KernBody muted>Onlinedienste der Justiz</KernBody>
          </div>

          <div className="page-shell__footer-logo">
            <BmjvLogo />
          </div>

          <nav aria-labelledby="footer-legal" className="page-shell__footer-legal">
            <KernHeading size="title-small" level={2} id="footer-legal">
              Rechtliche Hinweise
            </KernHeading>
            <LinkList links={legalLinks} />
          </nav>

          <nav aria-labelledby="footer-contact" className="page-shell__footer-contact">
            <KernHeading size="title-small" level={2} id="footer-contact">
              Kontakt und Teilnahme
            </KernHeading>
            <LinkList links={contactLinks} />
          </nav>

          <div className="page-shell__footer-pilot">
            <KernHeading size="title-small" level={2}>
              Ein Pilotprojekt des
            </KernHeading>
            <ExternalLinkList links={pilotLinks} />
          </div>

          <div className="page-shell__footer-operator">
            <KernHeading size="title-small" level={2}>
              Umsetzung und Betrieb
            </KernHeading>
            <ExternalLinkList links={operatorLinks} />
          </div>
        </div>
      </footer>
    </div>
  );
}
