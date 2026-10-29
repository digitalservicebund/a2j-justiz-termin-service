import { createElement, type ReactNode } from "react";

import { KernIcon } from "../kern/KernIcon";
import { KernLink } from "../kern/KernLink";

import "./A2JInlineNotice.css";

export type A2JInlineNoticeType = "warning" | "information" | "success" | "error";

export type A2JInlineNoticeProps = {
  type: A2JInlineNoticeType;
  // Mandatory. Say what the notice is about, don't just repeat the type ("Warnung", "Tipp").
  title: string;
  // The heading level of the document outline. Without it the title is a plain paragraph.
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  // The optional description. Can include lists. Keep it short.
  children?: ReactNode;
  // An optional action, shown below the description.
  link?: { href: string; label: string };
};

const kernIcons = {
  warning: "warning",
  information: "info",
  success: "success",
  error: "danger",
} as const;

// The alt text of the icon, as the design's accessibility notes prescribe. It is read out before
// the title.
const iconLabels: Record<A2JInlineNoticeType, string> = {
  warning: "Warnung",
  information: "Information",
  success: "Erfolg",
  error: "Fehler",
};

// A fork of the KERN alert for the A2J design's "Inline notice". It has no live-region role: it
// highlights content in the page and is not announced when it appears.
export function A2JInlineNotice({
  type,
  title,
  headingLevel,
  children,
  link,
}: Readonly<A2JInlineNoticeProps>) {
  const hasBody = Boolean(children) || Boolean(link);

  return (
    <div className={`a2j-inline-notice a2j-inline-notice--${type}`}>
      <div className="a2j-inline-notice__header">
        <span
          className={`kern-icon kern-icon--${kernIcons[type]} a2j-inline-notice__icon`}
          aria-hidden="true"
        ></span>
        <span className="kern-sr-only">{iconLabels[type]}</span>
        {createElement(
          headingLevel ? `h${headingLevel}` : "p",
          { className: "a2j-inline-notice__title" },
          title,
        )}
      </div>
      {hasBody && (
        <div className="a2j-inline-notice__body">
          {children && <div className="kern-body a2j-inline-notice__description">{children}</div>}
          {link && (
            <KernLink href={link.href} className="a2j-inline-notice__link">
              <KernIcon name="arrow-forward" />
              {link.label}
            </KernLink>
          )}
        </div>
      )}
    </div>
  );
}
