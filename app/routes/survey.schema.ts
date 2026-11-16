import type { BreadcrumbItem } from "~/components/shared/Breadcrumb";
import {
  answersByOffer,
  checkAvailability,
  mergeWindows,
  parseWindowKey,
  windowKey,
  type SlotWindow,
} from "~/core/domain/availability";
import { formatDay, formatTime } from "~/core/domain/time/format";
import type { TimeRange } from "~/core/domain/time/time-range";
import { berlinDay } from "~/core/domain/time/time-zone";

export const surveyBreadcrumbs = [
  { label: "Beantworten der Terminumfrage" },
] satisfies BreadcrumbItem[];

// The sorry page is the survey's "Terminumfrage" page for guests: no overview to go back to.
export const noMatchBreadcrumbs = [{ label: "Terminumfrage" }] satisfies BreadcrumbItem[];

export const MAX_NAME_LENGTH = 200;

export const messages = {
  name: "Geben Sie Ihren Namen an.",
  nameLength: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`,
  noChoice:
    "Wählen Sie mindestens ein Zeitfenster aus oder geben Sie an, dass kein Zeitfenster passt.",
  contradiction: "Sie können nicht zugleich Zeitfenster auswählen und angeben, dass keines passt.",
  unavailable: "Mindestens ein Zeitfenster steht nicht mehr zur Auswahl.",
};

// `available` holds window keys: one per availability window, whether the guest ticked a whole
// remaining window or added a smaller one. A key carries the times, because other answers can
// change what is left between two requests.
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
  | { success: true; name: string; availability: SlotWindow[] }
  | { success: false; errors: SurveyErrors };

// Behind the universal link the guest has to give a name; a personal link already knows it.
export function validateSurvey(
  values: SurveyValues,
  {
    needsName,
    offered,
    minDurationMinutes,
  }: { needsName: boolean; offered: SlotWindow[]; minDurationMinutes: number | null },
): Validation {
  const errors: SurveyErrors = {};
  const name = values.name.trim();
  if (needsName && !name) errors.name = messages.name;
  else if (needsName && name.length > MAX_NAME_LENGTH) errors.name = messages.nameLength;

  // A window that is not offered any more, in full or in part, is not clipped to what is left: the
  // guest answers again, seeing what is left.
  const windows = values.available.map(parseWindowKey);
  const parsed = windows.filter((window) => window !== undefined);
  const checked = checkAvailability(parsed, offered, minDurationMinutes);
  if (windows.length > 0 && values.none) errors.slots = messages.contradiction;
  else if (windows.length === 0 && !values.none) errors.slots = messages.noChoice;
  else if (parsed.length < windows.length || !checked.ok) errors.slots = messages.unavailable;

  if (errors.name || errors.slots || !checked.ok) return { success: false, errors };
  return { success: true, name, availability: checked.windows };
}

// The keys of a draft with one more availability window. Windows of a slot that overlap or touch
// become one right away. `replacing` is the key of the window that was edited, if any.
export function addWindow(available: string[], window: SlotWindow, replacing?: string): string[] {
  const kept = available
    .filter((key) => key !== replacing)
    .map(parseWindowKey)
    .filter((kept) => kept !== undefined);
  return mergeWindows([...kept, window]).map(windowKey);
}

export const removeWindow = (available: string[], key: string) =>
  available.filter((other) => other !== key);

type SurveyWindow = { id: string; time: string; start: string };

export type SurveyDay = { key: string; label: string; windows: SurveyWindow[] };

// Windows on the same Berlin day share one entry. Expects slots sorted by start.
export function groupWindows(slots: Array<TimeRange & { id: string }>): SurveyDay[] {
  const days: SurveyDay[] = [];
  for (const slot of slots) {
    const key = berlinDay(slot.start);
    const start = formatTime(slot.start);
    const window = { id: slot.id, start, time: `${start} bis ${formatTime(slot.end)}` };
    const last = days.at(-1);
    if (last?.key === key) last.windows.push(window);
    else days.push({ key, label: formatDay(slot.start), windows: [window] });
  }
  return days;
}

export type DayAnswer = { key: string; label: string; lines: string[] };

const formatTimes = ({ start, end }: TimeRange) => `${formatTime(start)} bis ${formatTime(end)}`;

// "10:00 bis 14:00 – verfügbar" for every offered window, as the review lists it. A window the
// guest is only partly available in is followed by the smaller windows.
export function describeAnswers(offered: SlotWindow[], availability: SlotWindow[]): DayAnswer[] {
  const days: DayAnswer[] = [];
  for (const { offer, state, windows } of answersByOffer(offered, availability)) {
    const key = berlinDay(offer.start);
    const lines =
      state === "partial"
        ? [
            `${formatTimes(offer)} – teilweise verfügbar`,
            ...windows.map((window) => `${formatTimes(window)} – verfügbar`),
          ]
        : [`${formatTimes(offer)} – ${state === "full" ? "verfügbar" : "nicht verfügbar"}`];
    const last = days.at(-1);
    if (last?.key === key) last.lines.push(...lines);
    else days.push({ key, label: formatDay(offer.start), lines });
  }
  return days;
}
