import { useState, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import type { BreadcrumbItem } from "~/components/shared/Breadcrumb";
import { Button } from "~/components/shared/Button";
import { Icon } from "~/components/shared/Icon";

import { isEmptySlot, type CreateTerminValues, type SlotInput } from "./create-termin.schema";

import "./create-termin.css";
import "./create-termin.review.css";

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const pad = (value: string) => value.padStart(2, "0");

export const createTerminBreadcrumbs = [
  { label: "Startseite", href: "/", icon: "home" },
  { label: "Verhandlungstermin-Finder", href: "/home" },
  { label: "Erstellen der Terminumfrage" },
] satisfies BreadcrumbItem[];

export type DayWindows = { key: string; label: string; times: string[] };

// Expects slots that passed validation. Windows on the same day share one entry.
export function groupSlotsByDay(slots: SlotInput[], separator = " – "): DayWindows[] {
  const windows = slots
    .filter((slot) => !isEmptySlot(slot))
    .map((slot) => {
      const key = `${slot.year}-${pad(slot.month)}-${pad(slot.day)}`;
      const start = `${pad(slot.startHour)}:${pad(slot.startMinute)}`;
      const end = `${pad(slot.endHour)}:${pad(slot.endMinute)}`;
      const date = new Date(Date.UTC(Number(slot.year), Number(slot.month) - 1, Number(slot.day)));
      return { key, label: dateFormat.format(date), start, time: `${start}${separator}${end}` };
    })
    .sort((a, b) => a.key.localeCompare(b.key) || a.start.localeCompare(b.start));

  const days: DayWindows[] = [];
  for (const { key, label, time } of windows) {
    const last = days.at(-1);
    if (last?.key === key) last.times.push(time);
    else days.push({ key, label, times: [time] });
  }
  return days;
}

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
        <h2 className="kern-title" id={`review-${id}`}>
          {title}
        </h2>
      </summary>
      <div className="kern-accordion__body">
        <div className="kern-summary__body create-termin-review__summary">
          {children}
          {editable && (
            <button type="submit" name="intent" value="back" className="kern-link">
              <Icon name="edit" />
              Bearbeiten<span className="kern-sr-only">{` ${title}`}</span>
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

export function ReviewItem({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="kern-description-list-item">
      <dt className="kern-description-list-item__key">{label}</dt>
      <dd className="kern-description-list-item__value">{children}</dd>
    </div>
  );
}

// A form that lists the sections for a last check. Every edit button and "Zurück" submit
// the intent "back"; the main button submits the given intent.
export function ReviewPage({
  sections,
  submit,
  className,
  children,
}: Readonly<{
  sections: ReviewSectionProps[];
  className?: string;
  submit: { label: string; intent: string };
  // Hidden inputs the action needs.
  children?: ReactNode;
}>) {
  const pending = useNavigation().state !== "idle";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => open[id] ?? true;
  const setAll = (value: boolean) =>
    setOpen(Object.fromEntries(sections.map(({ id }) => [id, value])));

  return (
    <div className={["create-termin", className].filter(Boolean).join(" ")}>
      <div className="page-shell__content">
        <Form method="post" className="create-termin__form">
          {children}
          <h1 className="kern-heading-large">Bitte überprüfen Sie Ihre Angaben</h1>

          <div className="create-termin-review__bulk">
            <Button type="button" style="secondary" onClick={() => setAll(true)}>
              Alle einblenden
            </Button>
            <Button type="button" style="secondary" onClick={() => setAll(false)}>
              Alle ausblenden
            </Button>
          </div>

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

          <div className="create-termin__actions">
            <Button type="submit" name="intent" value="back" style="secondary">
              Zurück
            </Button>
            <Button type="submit" name="intent" value={submit.intent} disabled={pending}>
              {submit.label}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}

export function CreateTerminReview({ values }: Readonly<{ values: CreateTerminValues }>) {
  return (
    <ReviewPage
      sections={[
        {
          id: "verhandlungsdaten",
          title: "Verhandlungsdaten",
          children: (
            <dl className="kern-description-list">
              <ReviewItem label="Aktenzeichen">{values.aktenzeichen}</ReviewItem>
            </dl>
          ),
        },
        {
          id: "zeitfenster",
          title: "Zeitfenster",
          children: (
            <dl className="kern-description-list">
              {groupSlotsByDay(values.slots).map(({ key, label, times }) => (
                <ReviewItem key={key} label={label}>
                  <ul className="create-termin-review__times">
                    {times.map((time) => (
                      <li key={time}>{time}</li>
                    ))}
                  </ul>
                </ReviewItem>
              ))}
            </dl>
          ),
        },
      ]}
      submit={{ label: "Terminumfrage erstellen", intent: "create" }}
    />
  );
}
