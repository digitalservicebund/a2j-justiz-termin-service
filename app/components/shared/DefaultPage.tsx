import type { ReactNode } from "react";

import { ReportProblemButton } from "./ReportProblemButton";

import "./DefaultPage.css";

export type PageWidth = "narrow" | "content" | "default" | "wide";

// The columns of KERN's 12-column grid each width takes, per breakpoint. They are the nearest
// spans to the widths of the design (720, 864, 992 and 1504px) in the container at that size,
// measured for a 1440px design frame. Below "md" every width fills the container.
const columns: Record<PageWidth, string> = {
  narrow: "kern-col-12 kern-col-md-11 kern-col-lg-9 kern-col-xl-7 kern-col-xxl-6",
  content: "kern-col-12 kern-col-lg-10 kern-col-xl-8 kern-col-xxl-7",
  default: "kern-col-12 kern-col-lg-11 kern-col-xl-9 kern-col-xxl-8",
  wide: "kern-col-12",
};

type PageSectionProps = {
  width?: PageWidth;
  children: ReactNode;
};

// A block centered at one of the page widths, for the sections of a page that has several. It is
// a KERN container with one centered column. Pages lay out their own content inside it.
export function PageSection({ width = "default", children }: Readonly<PageSectionProps>) {
  return (
    <div className="kern-container page-section" data-width={width}>
      <div className="kern-row kern-justify-content-center">
        <div className={`page-section__column ${columns[width]}`}>{children}</div>
      </div>
    </div>
  );
}

type DefaultPageProps = {
  width?: PageWidth;
  // Pages made of banners only have nothing to put here.
  children?: ReactNode;
};

// The content of a page, centered at one of the page widths. Use it once per page: it ends with the
// report-problem button, aligned to the right edge of the content.
export function DefaultPage({ width = "default", children }: Readonly<DefaultPageProps>) {
  return (
    <PageSection width={width}>
      {children}
      <ReportProblemButton />
    </PageSection>
  );
}
