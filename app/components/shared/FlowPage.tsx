import type { ReactNode } from "react";

import { PageSection, type PageWidth } from "./DefaultPage";
import { ReportProblemButton } from "./ReportProblemButton";

import "./FlowPage.css";

// The space above and below the content: the survey pages, the create form, or a review, which
// sits closer to the breadcrumb.
type FlowPageSpacing = "default" | "form" | "review";

type FlowPageProps = {
  width?: PageWidth;
  spacing?: FlowPageSpacing;
  children: ReactNode;
};

// The grey, full-width band of a flow page. Form inputs inside it sit on a white surface.
// Its content is centered at the given page width; pages lay out their own content in it. Use it
// once per page: the report-problem button follows below the band, at the same width.
export function FlowPage({
  width = "default",
  spacing = "default",
  children,
}: Readonly<FlowPageProps>) {
  return (
    <>
      <div className={`flow-page flow-page--${spacing}`}>
        <PageSection width={width}>{children}</PageSection>
      </div>
      <PageSection width={width}>
        <ReportProblemButton />
      </PageSection>
    </>
  );
}
