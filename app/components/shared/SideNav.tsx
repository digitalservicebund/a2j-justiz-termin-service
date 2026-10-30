import type { ReactNode } from "react";
import { Link } from "react-router";

import "./SideNav.css";

export type SideNavItem = {
  label: string;
  icon: ReactNode;
  // Items without a destination are shown but do not navigate yet.
  to?: string;
  current?: boolean;
};

type SideNavProps = {
  label: string;
  items: SideNavItem[];
};

export function SideNav({ label, items }: Readonly<SideNavProps>) {
  return (
    <nav aria-label={label} className="side-nav">
      <ul className="side-nav__list">
        {items.map(({ label: itemLabel, icon, to, current }) => (
          <li key={itemLabel}>
            {to ? (
              <Link
                to={to}
                className="side-nav__item kern-link"
                aria-current={current ? "page" : undefined}
              >
                {icon}
                {itemLabel}
              </Link>
            ) : (
              <span className="side-nav__item">
                {icon}
                {itemLabel}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
