import type { ReactNode } from "react";

import { KernGrid, KernGridCol, type KernGridColProps } from "./kern/KernGrid";
import { ReportProblemButton } from "./ReportProblemButton";

export type PageWidth = "narrow" | "content" | "default" | "wide";

// The columns of KERN's 12-column grid each width takes, per breakpoint. They are the nearest
// spans to the widths of the design (720, 864, 992 and 1504px) in the container at that size,
// measured for a 1440px design frame. Below "md" every width fills the container.
const columns: Record<PageWidth, Pick<KernGridColProps, "md" | "lg" | "xl" | "xxl">> = {
  narrow: { md: 11, lg: 9, xl: 7, xxl: 6 },
  content: { lg: 10, xl: 8, xxl: 7 },
  default: { lg: 11, xl: 9, xxl: 8 },
  wide: {},
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
      <KernGrid justify="center">
        <KernGridCol {...columns[width]}>{children}</KernGridCol>
      </KernGrid>
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
