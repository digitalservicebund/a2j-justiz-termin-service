import { MAX_SLOTS, todayInBerlin, type SlotInput } from "./create-termin.schema";

// What a window looks like while it is being edited: the text of three fields. Text the parsers
// cannot read is kept as typed, so the server validation can point at it.
export type WindowText = { date: string; start: string; end: string };

// Dates are ISO strings (YYYY-MM-DD) wherever they are compared or stored, times are minutes
// since midnight.
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

// Read when something happens, not while rendering, so it is always the current day.
export const berlinToday = () => todayInBerlin(new Date());

const pad = (value: number) => String(value).padStart(2, "0");

const toUtc = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
};

const toIso = (date: Date) =>
  `${String(date.getUTCFullYear()).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

function isoFromParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return toIso(date);
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

// Monday to Friday; public holidays are not taken into account.
export function nextWorkingDay(iso: string): string {
  let next = addDays(iso, 1);
  while ([0, 6].includes(toUtc(next).getUTCDay())) next = addDays(next, 1);
  return next;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[toUtc(iso).getUTCDay()]!;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const weekdayNames: Record<string, number> = {
  so: 0,
  sonntag: 0,
  mo: 1,
  montag: 1,
  di: 2,
  dienstag: 2,
  mi: 3,
  mittwoch: 3,
  do: 4,
  donnerstag: 4,
  fr: 5,
  freitag: 5,
  sa: 6,
  samstag: 6,
};

// Understands 27.10.2026, 27.10.26, 27.10. and 27.10 (the next 27 October that is not past),
// 2026-10-27, heute, morgen, übermorgen and weekday names (the next such day after today).
export function parseDate(text: string, today: string): string | null {
  const value = text.trim().toLowerCase().replace(/\.$/, "");
  if (value === "heute") return today;
  if (value === "morgen") return addDays(today, 1);
  if (value === "übermorgen") return addDays(today, 2);

  const weekday = weekdayNames[value];
  if (weekday !== undefined) {
    const offset = (weekday - toUtc(today).getUTCDay() + 7) % 7 || 7;
    return addDays(today, offset);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}|\d{2}))?$/.exec(value);
  if (!numeric) return null;
  const [day, month] = [Number(numeric[1]), Number(numeric[2])];
  if (numeric[3]) {
    const year = Number(numeric[3]);
    return isoFromParts(year < 100 ? 2000 + year : year, month, day);
  }
  const thisYear = Number(today.slice(0, 4));
  const candidate = isoFromParts(thisYear, month, day);
  if (candidate && candidate >= today) return candidate;
  return isoFromParts(thisYear + 1, month, day);
}

// Understands 9, 09, 9:30, 9.30, 930, 0930 and an optional "Uhr".
export function parseTime(text: string): number | null {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/\s*uhr$/, "");
  const match = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(value) ?? /^(\d{1,2})(\d{2})$/.exec(value);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2] ?? 0)];
  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
}

// "9-11", "9:00 – 11:00" and "9 bis 11" give start and end at once.
export function parseTimeRange(text: string): { start: number; end: number } | null {
  const parts = text.split(/\s*(?:-|–|—|\bbis\b)\s*/i);
  if (parts.length !== 2) return null;
  const [start, end] = [parseTime(parts[0]!), parseTime(parts[1]!)];
  return start === null || end === null ? null : { start, end };
}

// "+2h", "+1,5h", "+1h30", "+1:30", "+90" and "+90min" give the length of a window in minutes.
function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  const hours = /^\+\s*(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d{1,2})\s*(?:min|m)?)?$/.exec(value);
  if (hours) return Math.round(Number(hours[1]!.replace(",", ".")) * 60) + Number(hours[2] ?? 0);
  const clock = /^\+\s*(\d+):(\d{2})$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = /^\+\s*(\d+)\s*(?:min|m)?$/.exec(value);
  return minutes ? Number(minutes[1]) : null;
}

// The end of a window, typed either as a time or as a length counted from the start.
export function parseEnd(text: string, start: number | null): number | null {
  if (!text.trim().startsWith("+")) return parseTime(text);
  const duration = parseDuration(text);
  if (start === null || duration === null || duration === 0) return null;
  const end = start + duration;
  return end <= 23 * 60 + 59 ? end : null;
}

// Fields are tidied when they lose focus; text that cannot be read stays as typed.
export function normalizeDate(text: string, today: string): string {
  const iso = parseDate(text, today);
  return iso ? formatDate(iso) : text;
}

export function normalizeTime(text: string): string {
  const minutes = parseTime(text);
  return minutes === null ? text : formatTime(minutes);
}

// Splits typed dates such as "27.10., 28.10." into the readable ones and the text of the rest.
export function parseDateList(text: string, today: string): { dates: string[]; invalid: string[] } {
  const dates: string[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[,;\n]+/)) {
    if (!token.trim()) continue;
    const iso = parseDate(token, today);
    if (iso) dates.push(iso);
    else invalid.push(token.trim());
  }
  return { dates, invalid };
}

export function windowToSlot(window: WindowText, today: string): SlotInput {
  const iso = parseDate(window.date, today);
  const start = parseTime(window.start);
  const end = parseTime(window.end);
  const [year = "", month = "", day = ""] = iso ? iso.split("-") : [];
  return {
    day: iso ? day : window.date,
    month: iso ? month : "",
    year: iso ? year : "",
    startHour: start === null ? window.start : pad(Math.floor(start / 60)),
    startMinute: start === null ? "" : pad(start % 60),
    endHour: end === null ? window.end : pad(Math.floor(end / 60)),
    endMinute: end === null ? "" : pad(end % 60),
  };
}

const joinTime = (hour: string, minute: string) =>
  minute === "" ? hour : `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

export function slotToWindow(slot: SlotInput): WindowText {
  const dateIsText = slot.month === "" && slot.year === "";
  return {
    date: dateIsText
      ? slot.day
      : `${slot.day.padStart(2, "0")}.${slot.month.padStart(2, "0")}.${slot.year}`,
    start: joinTime(slot.startHour, slot.startMinute),
    end: joinTime(slot.endHour, slot.endMinute),
  };
}

// Oldest first; windows whose date or time cannot be read stay below the others in their order.
export function sortWindows<T extends WindowText>(windows: T[], today: string): T[] {
  const keyed = windows.map((window, position) => ({
    window,
    position,
    date: parseDate(window.date, today) ?? "9999-99-99",
    start: parseTime(window.start) ?? Infinity,
  }));
  keyed.sort(
    (a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.position - b.position,
  );
  return keyed.map(({ window }) => window);
}

export type AddResult = {
  added: WindowText[];
  past: number;
  duplicate: number;
  overLimit: number;
};

// One window per date. Dates in the past, windows that already exist and anything beyond the
// limit are left out and counted, so the caller can say what happened.
export function addWindows(
  existing: WindowText[],
  dates: string[],
  range: { start: number; end: number },
  today: string,
): AddResult {
  const taken = new Set(
    existing.map(
      (window) =>
        `${parseDate(window.date, today)}|${parseTime(window.start)}|${parseTime(window.end)}`,
    ),
  );
  const result: AddResult = { added: [], past: 0, duplicate: 0, overLimit: 0 };
  for (const date of [...new Set(dates)].sort()) {
    const key = `${date}|${range.start}|${range.end}`;
    if (date < today) result.past += 1;
    else if (taken.has(key)) result.duplicate += 1;
    else if (existing.length + result.added.length >= MAX_SLOTS) result.overLimit += 1;
    else {
      result.added.push({
        date: formatDate(date),
        start: formatTime(range.start),
        end: formatTime(range.end),
      });
    }
  }
  return result;
}

// "2 Zeitfenster hinzugefügt, 1 übersprungen (Datum in der Vergangenheit)"
export function summarizeAdd({ added, past, duplicate, overLimit }: AddResult): string {
  const reasons = [
    past && "Datum in der Vergangenheit",
    duplicate && "bereits vorhanden",
    overLimit && `höchstens ${MAX_SLOTS} Zeitfenster`,
  ].filter(Boolean);
  const skipped = past + duplicate + overLimit;
  const done = added.length
    ? `${added.length} Zeitfenster hinzugefügt`
    : "Kein Zeitfenster hinzugefügt";
  return skipped ? `${done}, ${skipped} übersprungen (${reasons.join(", ")})` : done;
}

// A window with the id the form keeps it under.
export type WindowRow = WindowText & { id: number };

// The week view: what it shows and how finely a drag snaps.
export const GRID_START = 7 * 60;
export const GRID_END = 19 * 60;
export const SLOT_MINUTES = 15;

export function mondayOf(iso: string): string {
  return addDays(iso, -((toUtc(iso).getUTCDay() + 6) % 7));
}

type Interval = { start: number; end: number };

// The window a drag from one cell to another makes, or null if it starts on a taken cell. The
// cells are SLOT_MINUTES long and both ends of the drag count. A drag stops at the next window
// in the direction it goes, so it can never reach over one.
export function dragRange(anchor: number, current: number, taken: Interval[]): Interval | null {
  if (taken.some(({ start, end }) => anchor >= start && anchor < end)) return null;
  const cell = (minutes: number) =>
    Math.min(Math.max(minutes, GRID_START), GRID_END - SLOT_MINUTES);
  const [from, to] = [cell(anchor), cell(current)];
  if (to >= from) {
    const ceiling = Math.min(GRID_END, ...taken.filter((t) => t.start > from).map((t) => t.start));
    return { start: from, end: Math.min(to + SLOT_MINUTES, ceiling) };
  }
  const floor = Math.max(GRID_START, ...taken.filter((t) => t.end <= from).map((t) => t.end));
  return { start: Math.max(to, floor), end: from + SLOT_MINUTES };
}
