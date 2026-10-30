import type { SurveySlot } from "~/adapters/appointments/survey.server";
import type { BreadcrumbItem } from "~/components/shared/Breadcrumb";

import { rangeToSlot } from "./create-termin.slots";
import { formatDay } from "./overview.select.schema";

export const surveyBreadcrumbs = [
  { label: "Beantworten der Terminumfrage" },
] satisfies BreadcrumbItem[];

export const MAX_NAME_LENGTH = 200;

export const messages = {
  name: "Geben Sie Ihren Namen an.",
  nameLength: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`,
  noChoice:
    "Wählen Sie mindestens ein Zeitfenster aus oder geben Sie an, dass kein Zeitfenster passt.",
  contradiction: "Sie können nicht zugleich Zeitfenster auswählen und angeben, dass keines passt.",
  unavailable: "Mindestens ein Zeitfenster steht nicht mehr zur Auswahl.",
};

// Windows are identified by their id, not by position, because other answers can hide windows
// between two requests.
export type SurveyValues = { name: string; available: string[]; none: boolean };

type SurveyErrors = { name?: string; slots?: string };

export const surveyPath = (token: string, page = "") =>
  `/umfrage/${encodeURIComponent(token)}${page}`;

export function readValues(source: URLSearchParams | FormData): SurveyValues {
  const name = source.get("name");
  return {
    name: typeof name === "string" ? name : "",
    available: source.getAll("verfuegbar").filter((id): id is string => typeof id === "string"),
    none: source.get("keines") === "1",
  };
}

export function surveySearch({ name, available, none }: SurveyValues): string {
  const search = new URLSearchParams();
  if (name) search.set("name", name);
  for (const id of available) search.append("verfuegbar", id);
  if (none) search.set("keines", "1");
  return search.toString();
}

type Validation =
  | { success: true; name: string; availableSlotIds: string[] }
  | { success: false; errors: SurveyErrors };

// Behind the universal link the guest has to give a name; a personal link already knows it.
export function validateSurvey(
  values: SurveyValues,
  { needsName, slotIds }: { needsName: boolean; slotIds: string[] },
): Validation {
  const errors: SurveyErrors = {};
  const name = values.name.trim();
  if (needsName && !name) errors.name = messages.name;
  else if (needsName && name.length > MAX_NAME_LENGTH) errors.name = messages.nameLength;

  const available = [...new Set(values.available)];
  if (available.length > 0 && values.none) errors.slots = messages.contradiction;
  else if (available.length === 0 && !values.none) errors.slots = messages.noChoice;
  else if (available.some((id) => !slotIds.includes(id))) errors.slots = messages.unavailable;

  if (errors.name || errors.slots) return { success: false, errors };
  return { success: true, name, availableSlotIds: available };
}

type SurveyWindow = { id: string; time: string; start: string };

export type SurveyDay = { key: string; label: string; windows: SurveyWindow[] };

// Windows on the same Berlin day share one entry. Expects slots sorted by start.
export function groupWindows(slots: SurveySlot[]): SurveyDay[] {
  const days: SurveyDay[] = [];
  for (const slot of slots) {
    const { year, month, day, startHour, startMinute, endHour, endMinute } = rangeToSlot(slot);
    const key = `${year}-${month}-${day}`;
    const start = `${startHour}:${startMinute}`;
    const window = { id: slot.id, start, time: `${start} bis ${endHour}:${endMinute}` };
    const last = days.at(-1);
    if (last?.key === key) last.windows.push(window);
    else days.push({ key, label: formatDay(slot.start), windows: [window] });
  }
  return days;
}

export type DayAnswer = { key: string; label: string; lines: string[] };

// "10:00 – verfügbar" for every offered window, as the review lists it.
export function describeAnswers(days: SurveyDay[], availableIds: string[]): DayAnswer[] {
  return days.map(({ key, label, windows }) => ({
    key,
    label,
    lines: windows.map(
      ({ id, start }) =>
        `${start} – ${availableIds.includes(id) ? "verfügbar" : "nicht verfügbar"}`,
    ),
  }));
}
