import { KernButton } from "./kern/KernButton";
import { KernIcon } from "./kern/KernIcon";
import { KernLabel } from "./kern/KernLabel";

import "./ReportProblemButton.css";

// Does nothing yet. Only the page layouts (DefaultPage, FlowPage) render it, at the right edge
// of their content, so it always lines up with what is above it.
export function ReportProblemButton() {
  return (
    <div className="report-problem">
      <KernButton type="button" style="secondary">
        <KernIcon name="danger" />
        <KernLabel>Problem mit dieser Seite melden</KernLabel>
      </KernButton>
    </div>
  );
}
