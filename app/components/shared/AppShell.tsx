import type { ReactNode } from "react";
import { Form } from "react-router";

import type { AuthUser } from "~/core/domain/user";

import { BmjvLogo } from "./BmjvLogo";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { KernKopfZeile } from "./KernKopfZeile";

import "./AppShell.css";

// Targets for these links are not defined in the design yet.
const TODO_HREF = "#";

type Link = { href: string; label: string };

const legalLinks: Link[] = [
  { href: TODO_HREF, label: "Impressum" },
  { href: TODO_HREF, label: "Barrierefreiheit" },
  { href: TODO_HREF, label: "Datenschutz" },
];

const contactLinks: Link[] = [
  { href: TODO_HREF, label: "Kontakt" },
  {
    href: "https://github.com/digitalservicebund/a2j-justiz-termin-service",
    label: "Open Source Code",
  },
  { href: TODO_HREF, label: "An Befragungen teilnehmen" },
];

const pilotLinks: Link[] = [
  {
    href: "https://www.bmj.de",
    label: "Bundesministeriums der Justiz und für Verbraucherschutz",
  },
];

const operatorLinks: Link[] = [
  {
    href: "https://digitalservice.bund.de",
    label: "DigitalService GmbH des Bundes",
  },
  {
    href: "https://zugang-zum-recht-projekte.de",
    label: "zugang-zum-recht-projekte.de",
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
            <Icon name="open-in-new" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

type AppShellProps = {
  breadcrumbs?: BreadcrumbItem[];
  user?: AuthUser;
  className?: string;
  showReportProblem?: boolean;
  children: ReactNode;
};

export function AppShell({
  breadcrumbs,
  user,
  className,
  showReportProblem = false,
  children,
}: Readonly<AppShellProps>) {
  const classes = ["page-shell", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <KernKopfZeile />

      <header className="page-shell__header">
        <div className="kern-container page-shell__header-inner">
          <p className="kern-heading-large page-shell__service-name">Justiz-Services</p>
          {user && (
            <div className="page-shell__user">
              <p className="kern-body kern-body--muted page-shell__user-info">
                <Icon name="account-circle" />
                <span>Angemeldet als:</span>
                <span>{user.email}</span>
              </p>
              <Form method="post" action="/?index">
                <input type="hidden" name="intent" value="logout" />
                <button type="submit" className="kern-link kern-link--small page-shell__logout">
                  <Icon name="logout" />
                  Abmelden
                </button>
              </Form>
            </div>
          )}
        </div>
      </header>

      <main>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="page-shell__breadcrumbs">
            <div className="kern-container">
              <Breadcrumb items={breadcrumbs} />
            </div>
          </div>
        )}

        {children}

        {showReportProblem && (
          <div className="page-shell__content page-shell__report">
            <Button type="button" style="secondary">
              <Icon name="danger" />
              <span className="kern-label">Problem mit dieser Seite melden</span>
            </Button>
          </div>
        )}
      </main>

      <footer className="page-shell__footer">
        <div className="kern-container page-shell__footer-grid">
          <div className="page-shell__footer-brand">
            <p className="kern-heading-medium">Verhandlungstermin-Finder</p>
            <p className="kern-body kern-body--muted">Onlinedienste der Justiz</p>
          </div>

          <div className="page-shell__footer-logo">
            <BmjvLogo />
          </div>

          <nav aria-labelledby="footer-legal" className="page-shell__footer-legal">
            <h2 className="kern-title kern-title--small" id="footer-legal">
              Rechtliche Hinweise
            </h2>
            <LinkList links={legalLinks} />
          </nav>

          <nav aria-labelledby="footer-contact" className="page-shell__footer-contact">
            <h2 className="kern-title kern-title--small" id="footer-contact">
              Kontakt und Teilnahme
            </h2>
            <LinkList links={contactLinks} />
          </nav>

          <div className="page-shell__footer-pilot">
            <h2 className="kern-title kern-title--small">Ein Pilotprojekt des</h2>
            <ExternalLinkList links={pilotLinks} />
          </div>

          <div className="page-shell__footer-operator">
            <h2 className="kern-title kern-title--small">Umsetzung und Betrieb</h2>
            <ExternalLinkList links={operatorLinks} />
          </div>
        </div>
      </footer>
    </div>
  );
}
