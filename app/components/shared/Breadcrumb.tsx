import { Icon, type IconName } from "./Icon";

import "./Breadcrumb.css";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: IconName;
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
                  <Icon name="chevron-right" />
                </span>
              )}
              {href && !isCurrent ? (
                <a
                  className="kern-link kern-link--no-visited-state"
                  href={href}
                  aria-label={icon ? label : undefined}
                >
                  {icon ? <Icon name={icon} /> : label}
                </a>
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
