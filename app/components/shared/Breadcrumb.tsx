import { Link } from "react-router";

import { KernIcon } from "./kern/KernIcon";
import { KernLink } from "./kern/KernLink";

import "./Breadcrumb.css";

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
};

export function Breadcrumb({ items = NO_ITEMS, className }: Readonly<BreadcrumbProps>) {
  const classes = ["breadcrumb", className].filter(Boolean).join(" ");
  const trail: BreadcrumbItem[] = [{ label: PRODUCT_NAME, href: "/" }, ...items];

  return (
    <nav aria-label="Brotkrumen" className={classes}>
      <ol className="breadcrumb__list">
        <li className="breadcrumb__item">
          <KernLink noVisitedState href={SERVICE_URL} aria-label="Startseite">
            <KernIcon name="home" />
          </KernLink>
        </li>
        {trail.map(({ label, href }, index) => {
          const isCurrent = index === trail.length - 1;

          return (
            <li key={`${index}-${label}`} className="breadcrumb__item">
              <span className="breadcrumb__separator" aria-hidden="true">
                <KernIcon name="chevron-right" />
              </span>
              {href && !isCurrent ? (
                <KernLink as={Link} size="small" noVisitedState to={href}>
                  {label}
                </KernLink>
              ) : (
                <span aria-current="page" className="kern-body kern-body--small">
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
