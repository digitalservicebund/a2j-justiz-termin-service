import type { ReactNode } from "react";

import { KernGrid, KernGridCol } from "./kern/KernGrid";
import { classNames } from "./kern/layout";
import { MainNav } from "./MainNav";

import "./SidebarPage.css";
import { ReportProblemButton } from "./ReportProblemButton";

type SidebarPageProps = {
  // The entry of the main navigation that is the current page.
  current: "overview" | "calendar";
  // The space between the report-problem button and the footer: the list pages leave more.
  spacing?: "default" | "roomy";
  children: ReactNode;
};

// A signed-in page: the main navigation in a sidebar of 3 of 12 columns from the lg breakpoint,
// and the content centered in the 9 columns next to it, so the sidebar stays where it is from page
// to page. Below lg the navigation stacks above the content. Use it once per page: it ends with the
// report-problem button, at the right edge of the content.
export function SidebarPage({
  current,
  spacing = "default",
  children,
}: Readonly<SidebarPageProps>) {
  return (
    <div
      className={classNames("kern-container sidebar-page kern-pt-xl", `sidebar-page--${spacing}`)}
    >
      <KernGrid gapY="xl">
        <KernGridCol lg={3}>
          <MainNav current={current} />
        </KernGridCol>
        <KernGridCol lg={9}>
          <KernGrid justify="center">
            <KernGridCol xl={10}>
              {children}
              <ReportProblemButton />
            </KernGridCol>
          </KernGrid>
        </KernGridCol>
      </KernGrid>
    </div>
  );
}
