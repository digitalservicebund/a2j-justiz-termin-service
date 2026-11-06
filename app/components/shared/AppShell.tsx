import type { ReactNode } from "react";
import { Form, Link as RouterLink, useRouteLoaderData } from "react-router";

import type { AuthUser } from "~/core/domain/user";

import { BmjvLogo } from "./BmjvLogo";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { contactLinks, legalLinks, operatorLinks, pilotLinks, type Link } from "./footer-links";
import { KernBody } from "./kern/KernBody";
import { KernCluster } from "./kern/KernCluster";
import { KernHeading } from "./kern/KernHeading";
import { KernIcon, type KernIconName } from "./kern/KernIcon";
import { KernKopfZeile } from "./kern/KernKopfZeile";
import { KernLink } from "./kern/KernLink";
import { KernStack } from "./kern/KernStack";
import { classNames, clusterClassName } from "./kern/layout";

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
    <KernStack as="ul" gap="sm">
      {links.map(({ href, label }) => (
        <li key={label}>
          <a className="kern-link" href={href}>
            {label}
          </a>
        </li>
      ))}
    </KernStack>
  );
}

function ExternalLinkList({ links }: Readonly<{ links: Link[] }>) {
  return (
    <KernStack as="ul" gap="sm">
      {links.map(({ href, label }) => (
        <li key={label}>
          <a className="kern-link" href={href} target="_blank" rel="noreferrer">
            <KernIcon name="open-in-new" />
            {label}
          </a>
        </li>
      ))}
    </KernStack>
  );
}

// The footer is a 12-column grid from "lg" up: two rows of a wide cell and two narrow ones.
// Below that its cells stack.
const footerCell = {
  brand: "kern-col-start-1-lg kern-col-end-7-lg kern-row-start-1-lg",
  logo: "kern-col-start-1-lg kern-col-end-7-lg kern-row-start-2-lg",
  legal: "kern-col-start-7-lg kern-col-end-10-lg kern-row-start-1-lg",
  contact: "kern-col-start-10-lg kern-col-end-13-lg kern-row-start-1-lg",
  pilot: "kern-col-start-7-lg kern-col-end-10-lg kern-row-start-2-lg",
  operator: "kern-col-start-10-lg kern-col-end-13-lg kern-row-start-2-lg",
};

type AppShellProps = {
  // The crumbs below the fixed ones; an empty list on the front page. No breadcrumb if omitted.
  breadcrumbs?: BreadcrumbItem[];
  user?: AuthUser;
  className?: string;
  // The easy-language and sign-language links are only shown on the front page.
  showLanguageLinks?: boolean;
  children: ReactNode;
};

export function AppShell({
  breadcrumbs,
  user: userProp,
  className,
  showLanguageLinks = false,
  children,
}: Readonly<AppShellProps>) {
  // Pages can pass the user themselves; otherwise it comes from the root loader. The root loader
  // is missing when it failed, as on the error page.
  const rootData = useRouteLoaderData<{ user: AuthUser | null }>("root");
  const user = userProp ?? rootData?.user ?? undefined;
  const classes = classNames("page-shell kern-flex kern-flex-col kern-min-h-screen", className);

  return (
    <div className={classes}>
      <KernKopfZeile />

      <header className="page-shell__header kern-py-lg">
        <div
          className={classNames(
            "kern-container",
            clusterClassName({ gap: "md", align: "center", justify: "between" }),
          )}
        >
          <KernHeading size="large" margin="none" className="page-shell__service-name">
            <RouterLink to="/" className="page-shell__service-link">
              Justiz-Services
            </RouterLink>
          </KernHeading>
          <KernCluster gapX="xl" gapY="md" align="center">
            {showLanguageLinks && (
              <nav aria-label="Sprachangebote">
                <KernCluster as="ul" gapX="xl" gapY="sm">
                  {languageLinks.map(({ href, label, icon }) => (
                    <li key={label}>
                      <KernLink size="small" href={href}>
                        <KernIcon name={icon} />
                        {label}
                      </KernLink>
                    </li>
                  ))}
                </KernCluster>
              </nav>
            )}
            {user && (
              <KernCluster gapX="xl" align="center">
                <KernBody
                  muted
                  margin="none"
                  className={classNames(
                    "page-shell__user-info",
                    clusterClassName({ gap: "sm", align: "center" }),
                  )}
                >
                  <KernIcon name="account-circle" />
                  <span>Angemeldet als:</span>
                  <span>{user.email}</span>
                </KernBody>
                {/* reloadDocument: with a basename React Router drops the `?index` of this action
                    during a client-side submit and posts to the current route instead. */}
                <Form method="post" action="/?index" reloadDocument>
                  <input type="hidden" name="intent" value="logout" />
                  <button
                    type="submit"
                    className={classNames(
                      "kern-link kern-link--small page-shell__logout",
                      clusterClassName({ inline: true, wrap: false, align: "center" }),
                    )}
                  >
                    <KernIcon name="logout" />
                    Abmelden
                  </button>
                </Form>
              </KernCluster>
            )}
          </KernCluster>
        </div>
      </header>

      <main>
        {breadcrumbs && (
          <div className="page-shell__breadcrumbs">
            <div className="kern-container">
              <Breadcrumb items={breadcrumbs} signedIn={Boolean(user)} />
            </div>
          </div>
        )}

        {children}
      </main>

      <footer className="page-shell__footer kern-mt-auto">
        <div className="kern-container page-shell__footer-grid kern-grid kern-grid-cols-1 kern-grid-cols-12-lg">
          <KernStack className={footerCell.brand}>
            <KernHeading size="medium" margin="none">
              Justiz-Services
            </KernHeading>
            <KernBody muted margin="none">
              Onlinedienste der Justiz
            </KernBody>
          </KernStack>

          <div className={footerCell.logo}>
            <BmjvLogo />
          </div>

          <KernStack as="nav" gap="sm" aria-labelledby="footer-legal" className={footerCell.legal}>
            <KernHeading size="title-small" level={2} margin="none" id="footer-legal">
              Rechtliche Hinweise
            </KernHeading>
            <LinkList links={legalLinks} />
          </KernStack>

          <KernStack
            as="nav"
            gap="sm"
            aria-labelledby="footer-contact"
            className={footerCell.contact}
          >
            <KernHeading size="title-small" level={2} margin="none" id="footer-contact">
              Kontakt und Teilnahme
            </KernHeading>
            <LinkList links={contactLinks} />
          </KernStack>

          <KernStack gap="sm" className={footerCell.pilot}>
            <KernHeading size="title-small" level={2} margin="none">
              Ein Pilotprojekt des
            </KernHeading>
            <ExternalLinkList links={pilotLinks} />
          </KernStack>

          <KernStack gap="sm" className={footerCell.operator}>
            <KernHeading size="title-small" level={2} margin="none">
              Umsetzung und Betrieb
            </KernHeading>
            <ExternalLinkList links={operatorLinks} />
          </KernStack>
        </div>
      </footer>
    </div>
  );
}
