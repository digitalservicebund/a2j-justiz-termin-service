import type { ReactNode } from "react";

import { ReportProblemButton } from "./ReportProblemButton";

import "./DefaultPage.css";

export type PageWidth = "narrow" | "content" | "default" | "wide";

export function pageWidthClass(width: PageWidth): string {
  return `page-width page-width--${width}`;
}

type PageSectionProps = {
  width?: PageWidth;
  children: ReactNode;
};

// A block centered at one of the page widths from app.css, for the sections of a page that has
// several. Pages lay out their own content in the elements they put inside it.
export function PageSection({ width = "default", children }: Readonly<PageSectionProps>) {
  return <div className={pageWidthClass(width)}>{children}</div>;
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
