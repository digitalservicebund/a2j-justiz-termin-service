import type { ReactNode } from "react";

import "./FlowPage.css";

type FlowPageProps = {
  className?: string;
  children: ReactNode;
};

// The grey, full-width band of a flow page. Form inputs inside it sit on a white surface.
// Pages lay out their own content and may set --flow-page-padding-start and
// --flow-page-padding-end on their class to change the space above and below.
export function FlowPage({ className, children }: Readonly<FlowPageProps>) {
  return <div className={["flow-page", className].filter(Boolean).join(" ")}>{children}</div>;
}
