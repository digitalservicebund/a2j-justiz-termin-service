import type { BreadcrumbItem } from "~/components/shared/Breadcrumb";
import { OVERVIEW_PATH } from "~/lib/web/paths";

export const selectBreadcrumbs = [
  { label: "Übersicht", href: OVERVIEW_PATH },
  { label: "Auswahl des Termins" },
] satisfies BreadcrumbItem[];

export const messages = {
  slot: "Wählen Sie ein Zeitfenster aus.",
  start: "Geben Sie eine gültige Startzeit an.",
  notExactlyOnce:
    "Diese Uhrzeit gibt es wegen der Zeitumstellung nicht oder zweimal. Wählen Sie eine andere.",
  outside: (from: string, to: string) => `Die Startzeit muss zwischen ${from} und ${to} liegen.`,
  tooShort: (latest: string, minDuration: string) =>
    `Die Startzeit darf nicht nach ${latest} liegen, damit mindestens ${minDuration} bleiben.`,
};

// `slot` is the key of the remaining window the judge picked. It carries the times, so a window
// that an answer changed in the meantime is not found any more instead of standing for another.
export type SelectValues = { slot: string; hour: string; minute: string };

export type SelectErrors = { slot?: string; start?: string };

export const emptyValues: SelectValues = { slot: "", hour: "", minute: "" };

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
