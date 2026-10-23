import type { ReactNode } from "react";

import { type PageWidth, pageWidthClass } from "./DefaultPage";

import "./FlowPage.css";

type FlowPageProps = {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
};

// The grey, full-width band of a flow page. Form inputs inside it sit on a white surface.
// Its content is centered at the given page width. Pages lay out their own content and may set --flow-page-padding-start and
// --flow-page-padding-end on their class to change the space above and below.
export function FlowPage({ width = "default", className, children }: Readonly<FlowPageProps>) {
  return (
    <div className={["flow-page", className].filter(Boolean).join(" ")}>
      <div className={pageWidthClass(width)}>{children}</div>
    </div>
  );
}
