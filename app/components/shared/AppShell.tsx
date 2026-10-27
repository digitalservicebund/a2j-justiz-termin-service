import type { ReactNode } from "react";
import { Form } from "react-router";

import type { AuthUser } from "~/core/domain/user";

import { BmjvLogo } from "./BmjvLogo";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { DefaultPage } from "./DefaultPage";
import { contactLinks, legalLinks, operatorLinks, pilotLinks, type Link } from "./footer-links";
import { KernBody } from "./kern/KernBody";
import { KernButton } from "./kern/KernButton";
import { KernHeading } from "./kern/KernHeading";
import { KernIcon } from "./kern/KernIcon";
import { KernKopfZeile } from "./kern/KernKopfZeile";
import { KernLabel } from "./kern/KernLabel";

import "./AppShell.css";

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
          <KernHeading size="large" className="page-shell__service-name">
            Justiz-Services
          </KernHeading>
          {user && (
            <div className="page-shell__user">
              <KernBody muted className="page-shell__user-info">
                <KernIcon name="account-circle" />
                <span>Angemeldet als:</span>
                <span>{user.email}</span>
              </KernBody>
              <Form method="post" action="/?index">
                <input type="hidden" name="intent" value="logout" />
                <button type="submit" className="kern-link kern-link--small page-shell__logout">
                  <KernIcon name="logout" />
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
          <DefaultPage>
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
            <KernHeading size="medium">Verhandlungstermin-Finder</KernHeading>
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
