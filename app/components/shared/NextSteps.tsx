import { DefaultPage } from "~/components/shared/DefaultPage";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import { ResultBanner } from "~/components/shared/ResultBanner";
import { OVERVIEW_PATH } from "~/lib/paths";

import "./NextSteps.css";

export function Step({ title, children }: Readonly<{ title: string; children?: React.ReactNode }>) {
  return (
    <KernCluster as="li" wrap={false} gap="md" align="start" className="next-steps__step">
      <KernStack gap="sm" align="start" className="next-steps__step-body kern-flex-1 kern-pt-xs">
        <KernHeading className="kern-m-none" size="title" level={3}>
          {title}
        </KernHeading>
        {children}
      </KernStack>
    </KernCluster>
  );
}

// Success banner and the numbered steps that follow, shared with the page after choosing a Termin.
// The link back to the judge's overview is left out for guests, who have no overview.
export function SuccessBanner({
  title,
  overviewLink = true,
}: Readonly<{ title: string; overviewLink?: boolean }>) {
  return (
    <ResultBanner
      type="success"
      title={title}
      actions={
        <>
          <a className="kern-btn kern-btn--primary" href="#naechste-schritte">
            <KernLabel>Nächste Schritte</KernLabel>
            <KernIcon name="arrow-down" />
          </a>
          {overviewLink && (
            <KernLinkButton style="secondary" to={OVERVIEW_PATH}>
              <KernLabel>Zu den Terminumfragen</KernLabel>
              <KernIcon name="arrow-forward" />
            </KernLinkButton>
          )}
        </>
      }
    />
  );
}

// The heading and the numbered steps, for pages that lay out their own content column.
export function NextStepsSection({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <KernStack as="section" gap="md" aria-labelledby="naechste-schritte">
      <KernHeading size="large" level={2} id="naechste-schritte">
        Nächste Schritte
      </KernHeading>
      <KernStack as="ol" className="next-steps__list">
        {children}
      </KernStack>
    </KernStack>
  );
}

export function NextSteps({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DefaultPage>
      <NextStepsSection>{children}</NextStepsSection>
    </DefaultPage>
  );
}
