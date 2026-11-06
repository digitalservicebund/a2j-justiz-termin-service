import type { ReactNode } from "react";

import { A2JIcon } from "./a2j/A2JIcon";
import { PageSection } from "./DefaultPage";
import { KernBody } from "./kern/KernBody";
import { KernCluster } from "./kern/KernCluster";
import { KernHeading } from "./kern/KernHeading";
import { KernIcon } from "./kern/KernIcon";
import { KernStack } from "./kern/KernStack";
import { classNames, clusterClassName } from "./kern/layout";

import "./ResultBanner.css";

type ResultBannerProps = {
  // "default" is the neutral banner for a page that looks back, with a history icon.
  type: "default" | "success" | "info" | "warning" | "danger";
  // Without the wide page section, for banners that sit in a column next to the sidebar.
  inline?: boolean;
  title: string;
  message?: string;
  actions?: ReactNode;
};

const bannerLayout = clusterClassName({ wrap: false, gap: "md", align: "start" });

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
    <div
      className={classNames(
        type === "default" ? "result-banner--default" : `kern-alert kern-alert--${type}`,
        "result-banner",
        bannerLayout,
      )}
    >
      {type === "default" ? (
        <A2JIcon name="history" size="x-large" />
      ) : (
        <KernIcon name={type} size="x-large" />
      )}
      <KernStack gap="lg" align="start" className="result-banner__body">
        <KernStack gap="sm" className="result-banner__text">
          <KernHeading size="large" level={1}>
            {title}
          </KernHeading>
          {message && <KernBody bold>{message}</KernBody>}
        </KernStack>
        {actions && (
          <KernCluster gap="lg" className="result-banner__actions">
            {actions}
          </KernCluster>
        )}
      </KernStack>
    </div>
  );
  return inline ? banner : <PageSection width="wide">{banner}</PageSection>;
}
