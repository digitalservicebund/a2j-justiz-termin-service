import { Link } from "react-router";

import { KernIcon, type KernIconName } from "./kern/KernIcon";
import { KernLink } from "./kern/KernLink";

import "./Breadcrumb.css";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: KernIconName;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumb({ items, className }: Readonly<BreadcrumbProps>) {
  const classes = ["breadcrumb", className].filter(Boolean).join(" ");

  return (
    <nav aria-label="Brotkrumen" className={classes}>
      <ol className="breadcrumb__list">
        {items.map(({ label, href, icon }, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li key={label} className="breadcrumb__item">
              {index > 0 && (
                <span className="breadcrumb__separator" aria-hidden="true">
                  <KernIcon name="chevron-right" />
                </span>
              )}
              {href && !isCurrent ? (
                <KernLink
                  as={Link}
                  size="small"
                  className="kern-link--no-visited-state"
                  to={href}
                  aria-label={icon ? label : undefined}
                >
                  {icon ? <KernIcon name={icon} /> : label}
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
