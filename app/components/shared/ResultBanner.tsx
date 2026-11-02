import type { ReactNode } from "react";

import { PageSection } from "./DefaultPage";
import { KernBody } from "./kern/KernBody";
import { KernHeading } from "./kern/KernHeading";
import { KernIcon } from "./kern/KernIcon";

import "./ResultBanner.css";

type ResultBannerProps = {
  type: "success" | "warning" | "danger";
  // Without the wide page section, for banners that sit in a column next to the sidebar.
  inline?: boolean;
  title: string;
  message?: string;
  actions?: ReactNode;
};

// The wide banner on top of a result page: an icon, the headline, and optionally a message and
// the actions that follow from it.
export function ResultBanner({
  type,
  title,
  message,
  actions,
  inline,
}: Readonly<ResultBannerProps>) {
  const banner = (
    <div className={`kern-alert kern-alert--${type} result-banner`}>
      <KernIcon name={type} size="x-large" />
      <div className="result-banner__body">
        <div className="result-banner__text">
          <KernHeading size="large" level={1}>
            {title}
          </KernHeading>
          {message && <KernBody bold>{message}</KernBody>}
        </div>
        {actions && <div className="result-banner__actions">{actions}</div>}
      </div>
    </div>
  );
  return inline ? banner : <PageSection width="wide">{banner}</PageSection>;
}
