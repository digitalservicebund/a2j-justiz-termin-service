import type { ReactNode } from "react";
import { Link } from "react-router";

import { KernStack } from "./kern/KernStack";
import { clusterClassName } from "./kern/layout";

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

const itemLayout = clusterClassName({ inline: true, wrap: false, gap: "sm", align: "center" });

export function SideNav({ label, items }: Readonly<SideNavProps>) {
  return (
    <nav aria-label={label} className="side-nav">
      <KernStack as="ul" gap="sm">
        {items.map(({ label: itemLabel, icon, to, current }) => (
          <li key={itemLabel}>
            {to ? (
              <Link
                to={to}
                className={`side-nav__item kern-link ${itemLayout}`}
                aria-current={current ? "page" : undefined}
              >
                {icon}
                {itemLabel}
              </Link>
            ) : (
              <span className={`side-nav__item ${itemLayout}`}>
                {icon}
                {itemLabel}
              </span>
            )}
          </li>
        ))}
      </KernStack>
    </nav>
  );
}
