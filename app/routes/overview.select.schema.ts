import type { TimeRange } from "~/adapters/appointments/appointments.server";
import type { BreadcrumbItem } from "~/components/shared/Breadcrumb";

import { rangeToSlot, slotToRange } from "./create-termin.slots";

export const selectBreadcrumbs = [
  { label: "Startseite", href: "/", icon: "home" },
  { label: "Verhandlungstermin-Finder", href: "/home" },
  { label: "Übersicht", href: "/overview" },
  { label: "Auswahl des Termins" },
] satisfies BreadcrumbItem[];

export const messages = {
  slot: "Wählen Sie ein Zeitfenster aus.",
  start: "Geben Sie eine gültige Startzeit an.",
  outside: (from: string, to: string) => `Die Startzeit muss zwischen ${from} und ${to} liegen.`,
};

// The window is picked by its position among the appointment's slots, which are sorted by start.
export type SelectValues = { slot: string; hour: string; minute: string };

export type SelectErrors = { slot?: string; start?: string };

export const emptyValues: SelectValues = { slot: "", hour: "", minute: "" };

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

const pad = (value: string) => value.padStart(2, "0");

const timeOf = (hour: string, minute: string) => `${pad(hour)}:${pad(minute)}`;

// "17. September 2026 von 15:30 bis 18:00"
export function describeSlot(range: TimeRange): string {
  const { startHour, startMinute, endHour, endMinute } = rangeToSlot(range);
  return `${dateFormat.format(range.start)} von ${timeOf(startHour, startMinute)} bis ${timeOf(endHour, endMinute)}`;
}

const parts = (value: string, pattern: RegExp, max: number) =>
  pattern.test(value) && Number(value) <= max ? Number(value) : null;

type Selection = { success: true; window: TimeRange } | { success: false; errors: SelectErrors };

// The judge picks one of the slots and the time it starts. The window then runs until the slot
// ends, so it can only become shorter than the slot, never longer.
export function validateSelection(values: SelectValues, slots: TimeRange[]): Selection {
  const slot = /^\d+$/.test(values.slot) ? slots[Number(values.slot)] : undefined;
  if (!slot) return { success: false, errors: { slot: messages.slot } };

  const hour = parts(values.hour.trim(), /^\d{1,2}$/, 23);
  const minute = parts(values.minute.trim(), /^\d{1,2}$/, 59);
  if (hour === null || minute === null)
    return { success: false, errors: { start: messages.start } };

  const day = rangeToSlot(slot);
  const start = slotToRange({
    ...day,
    startHour: String(hour),
    startMinute: String(minute),
  }).start;
  if (start < slot.start || start >= slot.end) {
    const { startHour, startMinute, endHour, endMinute } = day;
    return {
      success: false,
      errors: {
        start: messages.outside(timeOf(startHour, startMinute), timeOf(endHour, endMinute)),
      },
    };
  }
  return { success: true, window: { start, end: slot.end } };
}

export function readValues(source: URLSearchParams | FormData): SelectValues {
  const read = (key: string) => {
    const value = source.get(key);
    return typeof value === "string" ? value : "";
  };
  return { slot: read("fenster"), hour: read("stunde"), minute: read("minute") };
}

export function selectionSearch({ slot, hour, minute }: SelectValues): string {
  return new URLSearchParams({ fenster: slot, stunde: hour, minute }).toString();
}
