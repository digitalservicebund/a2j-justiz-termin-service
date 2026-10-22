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

type SectionId = "verhandlungsdaten" | "zeitfenster";

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: Readonly<{
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}>) {
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
          <button type="submit" name="intent" value="back" className="kern-link">
            <Icon name="edit" />
            Bearbeiten<span className="kern-sr-only">{` ${title}`}</span>
          </button>
        </div>
      </div>
    </details>
  );
}

function Item({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="kern-description-list-item">
      <dt className="kern-description-list-item__key">{label}</dt>
      <dd className="kern-description-list-item__value">{children}</dd>
    </div>
  );
}

export function CreateTerminReview({ values }: Readonly<{ values: CreateTerminValues }>) {
  const pending = useNavigation().state !== "idle";
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    verhandlungsdaten: true,
    zeitfenster: true,
  });
  const setAll = (value: boolean) => setOpen({ verhandlungsdaten: value, zeitfenster: value });
  const toggle = (id: SectionId) => (value: boolean) =>
    setOpen((current) => ({ ...current, [id]: value }));

  return (
    <div className="create-termin">
      <div className="page-shell__content">
        <Form method="post" className="create-termin__form">
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
            <Section
              id="verhandlungsdaten"
              title="Verhandlungsdaten"
              open={open.verhandlungsdaten}
              onToggle={toggle("verhandlungsdaten")}
            >
              <dl className="kern-description-list">
                <Item label="Aktenzeichen">{values.aktenzeichen}</Item>
              </dl>
            </Section>
            <Section
              id="zeitfenster"
              title="Zeitfenster"
              open={open.zeitfenster}
              onToggle={toggle("zeitfenster")}
            >
              <dl className="kern-description-list">
                {groupSlotsByDay(values.slots).map(({ key, label, times }) => (
                  <Item key={key} label={label}>
                    <ul className="create-termin-review__times">
                      {times.map((time) => (
                        <li key={time}>{time}</li>
                      ))}
                    </ul>
                  </Item>
                ))}
              </dl>
            </Section>
          </div>

          <div className="create-termin__actions">
            <Button type="submit" name="intent" value="back" style="secondary">
              Zurück
            </Button>
            <Button type="submit" name="intent" value="create" disabled={pending}>
              Terminumfrage erstellen
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
