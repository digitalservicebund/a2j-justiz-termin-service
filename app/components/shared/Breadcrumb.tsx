import { Link } from "react-router";

import { BASE_PATH } from "~/lib/base-path";

import { KernCluster } from "./kern/KernCluster";
import { KernIcon } from "./kern/KernIcon";
import { KernLink } from "./kern/KernLink";

import "./Breadcrumb.css";
import { classNames } from "./kern/layout";

const SERVICE_URL = "https://service.justiz.de/";
const PRODUCT_NAME = "Verhandlungstermin-Finder";
const NO_ITEMS: BreadcrumbItem[] = [];

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  // The crumbs below the fixed ones (the service home and the Verhandlungstermin-Finder). Leave
  // empty on the Verhandlungstermin-Finder's own front page.
  items?: BreadcrumbItem[];
  className?: string;
  // Signed-in users stay inside the app; everyone else gets the product's public start page.
  signedIn?: boolean;
};

export function Breadcrumb({
  items = NO_ITEMS,
  className,
  signedIn = false,
}: Readonly<BreadcrumbProps>) {
  const classes = classNames("breadcrumb", className);
  const trail: BreadcrumbItem[] = [{ label: PRODUCT_NAME, href: "/" }, ...items];

  return (
    <nav aria-label="Brotkrumen" className={classes}>
      <KernCluster as="ol" gap="xs" align="center">
        <KernCluster as="li" wrap={false} gap="xs" align="center">
          <KernLink noVisitedState href={SERVICE_URL} aria-label="Startseite">
            <KernIcon name="home" />
          </KernLink>
        </KernCluster>
        {trail.map(({ label, href }, index) => {
          const isCurrent = index === trail.length - 1;

          return (
            <KernCluster as="li" key={`${index}-${label}`} wrap={false} gap="xs" align="center">
              <KernCluster
                as="span"
                wrap={false}
                className="breadcrumb__separator"
                aria-hidden="true"
              >
                <KernIcon name="chevron-right" />
              </KernCluster>
              {href && !isCurrent && index === 0 && !signedIn ? (
                <KernLink size="small" noVisitedState href={`${BASE_PATH}/`}>
                  {label}
                </KernLink>
              ) : href && !isCurrent ? (
                <KernLink as={Link} size="small" noVisitedState to={href}>
                  {label}
                </KernLink>
              ) : (
                <span aria-current="page" className="kern-body kern-body--small">
                  {label}
                </span>
              )}
            </KernCluster>
          );
        })}
      </KernCluster>
    </nav>
  );
}
