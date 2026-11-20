import { useState, type ReactNode } from "react";
import { useNavigation } from "react-router";

import { FlowPage } from "~/components/shared/FlowPage";
import { FormActions, FormStack } from "~/components/shared/FormLayout";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { useHydrated } from "~/lib/use-hydrated";

import "./ReviewPage.css";

type ReviewSectionProps = {
  id: string;
  title: string;
  // Sections offer to go back and edit unless this is turned off.
  editable?: boolean;
  children: ReactNode;
};

function Section({
  id,
  title,
  editable = true,
  open,
  onToggle,
  children,
}: Readonly<ReviewSectionProps & { open: boolean; onToggle: (open: boolean) => void }>) {
  return (
    <details
      className="kern-accordion"
      aria-labelledby={`review-${id}`}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="kern-accordion__header">
        <KernHeading size="title" level={2} id={`review-${id}`}>
          {title}
        </KernHeading>
      </summary>
      <div className="kern-accordion__body">
        <div className="kern-summary__body review-page__summary">
          {children}
          {editable && (
            <button type="submit" name="intent" value="back" className="kern-link">
              <KernIcon name="edit" />
              Bearbeiten <span className="kern-sr-only">{title}</span>
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

// A form that lists the sections for a last check. Every edit button and "Zurück" submit
// the intent "back"; the main button submits the given intent.
export function ReviewPage({
  sections,
  submit,
  wide = false,
  children,
}: Readonly<{
  sections: ReviewSectionProps[];
  // The survey and overview reviews are wider than the create-termin review, and sit closer to
  // the breadcrumb.
  wide?: boolean;
  submit: { label: string; intent: string };
  // Hidden inputs the action needs.
  children?: ReactNode;
}>) {
  const pending = useNavigation().state !== "idle";
  const hydrated = useHydrated();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => open[id] ?? true;
  const setAll = (value: boolean) =>
    setOpen(Object.fromEntries(sections.map(({ id }) => [id, value])));

  return (
    <FlowPage width={wide ? "default" : "narrow"} spacing={wide ? "review" : "form"}>
      <FormStack method="post">
        {children}
        <KernHeading size="large" level={1}>
          Bitte überprüfen Sie Ihre Angaben
        </KernHeading>

        {/* The sections are plain <details>; opening them all at once needs JavaScript. */}
        {hydrated && (
          <KernCluster gap="md">
            <KernButton type="button" style="secondary" onClick={() => setAll(true)}>
              Alle einblenden
            </KernButton>
            <KernButton type="button" style="secondary" onClick={() => setAll(false)}>
              Alle ausblenden
            </KernButton>
          </KernCluster>
        )}

        <div>
          {sections.map(({ id, children: content, ...section }) => (
            <Section
              key={id}
              id={id}
              {...section}
              open={isOpen(id)}
              onToggle={(value) => setOpen((current) => ({ ...current, [id]: value }))}
            >
              {content}
            </Section>
          ))}
        </div>

        <FormActions>
          <KernButton type="submit" name="intent" value="back" style="secondary">
            Zurück
          </KernButton>
          <KernButton type="submit" name="intent" value={submit.intent} disabled={pending}>
            {submit.label}
          </KernButton>
        </FormActions>
      </FormStack>
    </FlowPage>
  );
}
