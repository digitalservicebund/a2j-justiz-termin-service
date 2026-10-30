import { KernButton } from "./kern/KernButton";
import { KernIcon } from "./kern/KernIcon";
import { KernLabel } from "./kern/KernLabel";

// Does nothing yet. The page around it decides where it sits: AppShell places it below the page
// content, pages with their own layout place it inside their content column.
export function ReportProblemButton() {
  return (
    <KernButton type="button" style="secondary">
      <KernIcon name="danger" />
      <KernLabel>Problem mit dieser Seite melden</KernLabel>
    </KernButton>
  );
}
