import { z } from "zod";

import { formatCalendarDate } from "~/core/domain/time/format";
import { berlinDay } from "~/core/domain/time/time-zone";
import { checkWallClock, type WallClockKind } from "~/core/domain/time/wall-clock";

export const MIN_SLOTS = 2;
export const MAX_SLOTS = 20;
const MAX_AKTENZEICHEN_LENGTH = 50;

export const messages = {
  aktenzeichenRequired: "Geben Sie ein Aktenzeichen an.",
  aktenzeichenTooLong: `Das Aktenzeichen darf höchstens ${MAX_AKTENZEICHEN_LENGTH} Zeichen lang sein.`,
  date: "Geben Sie ein gültiges Datum an.",
  pastDate: "Das Datum darf nicht in der Vergangenheit liegen.",
  start: "Geben Sie eine gültige Startzeit an.",
  end: "Geben Sie eine gültige Endzeit an.",
  range: "Die Endzeit muss nach der Startzeit liegen.",
  skippedTime: "Diese Uhrzeit gibt es wegen der Zeitumstellung nicht. Wählen Sie eine andere.",
  repeatedTime: "Diese Uhrzeit kommt wegen der Zeitumstellung zweimal vor. Wählen Sie eine andere.",
  overlap: (otherRow: number) =>
    `Dieses Zeitfenster überschneidet sich mit Zeitfenster ${otherRow}.`,
  // On the page of a single time slot there is no row number to point to.
  overlapWith: (when: string) =>
    `Dieses Zeitfenster überschneidet sich mit dem Zeitfenster ${when}.`,
  tooFewSlots: "Geben Sie mindestens zwei Zeitfenster an.",
  tooManySlots: `Geben Sie höchstens ${MAX_SLOTS} Zeitfenster an.`,
};

const slotFields = [
  "day",
  "month",
  "year",
  "startHour",
  "startMinute",
  "endHour",
  "endMinute",
] as const;

export type SlotField = (typeof slotFields)[number];
export type SlotInput = Record<SlotField, string>;

// Part of a row an error belongs to. "range" covers the start/end pair, "overlap" the whole row.
export type SlotErrorGroup = "date" | "start" | "end" | "range" | "overlap";

export const emptySlot: SlotInput = {
  day: "",
  month: "",
  year: "",
  startHour: "",
  startMinute: "",
  endHour: "",
  endMinute: "",
};

export function isEmptySlot(slot: SlotInput): boolean {
  return slotFields.every((field) => slot[field].trim() === "");
}

const SlotInputSchema = z.object({
  day: z.string().trim(),
  month: z.string().trim(),
  year: z.string().trim(),
  startHour: z.string().trim(),
  startMinute: z.string().trim(),
  endHour: z.string().trim(),
  endMinute: z.string().trim(),
});

function toNumber(value: string, pattern: RegExp): number | null {
  return pattern.test(value) ? Number(value) : null;
}

function parseDate(slot: SlotInput): string | null {
  const year = toNumber(slot.year, /^\d{4}$/);
  const month = toNumber(slot.month, /^\d{1,2}$/);
  const day = toNumber(slot.day, /^\d{1,2}$/);
  if (year === null || month === null || day === null) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day].map((part, i) => String(part).padStart(i === 0 ? 4 : 2, "0")).join("-");
}

function parseMinutes(hour: string, minute: string): number | null {
  const h = toNumber(hour, /^\d{1,2}$/);
  const m = toNumber(minute, /^\d{1,2}$/);
  if (h === null || m === null || h > 23 || m > 59) return null;
  return h * 60 + m;
}

const timeMessage: Record<Exclude<WallClockKind, "ok">, string> = {
  skipped: messages.skippedTime,
  repeated: messages.repeatedTime,
};

// The switch between summer and winter time skips or repeats an hour at night, and a wall-clock
// time in it does not name one instant.
function timeProblem(date: string, minutes: number): string | null {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const kind = checkWallClock({
    year,
    month,
    day,
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
  });
  return kind === "ok" ? null : timeMessage[kind];
}

type CompleteSlot = { index: number; date: string; start: number; end: number };

type SlotIssue = { group: SlotErrorGroup; message: string };

// Everything that is wrong with one filled-in slot, and its parsed parts when nothing is.
function checkSlot(
  slot: SlotInput,
  now: Date,
): { issues: SlotIssue[]; parsed?: { date: string; start: number; end: number } } {
  const issues: SlotIssue[] = [];
  const add = (group: SlotErrorGroup, message: string) => issues.push({ group, message });

  const date = parseDate(slot);
  const start = parseMinutes(slot.startHour, slot.startMinute);
  const end = parseMinutes(slot.endHour, slot.endMinute);

  if (date === null) add("date", messages.date);
  else if (date < berlinDay(now)) add("date", messages.pastDate);
  if (start === null) add("start", messages.start);
  else if (date !== null) {
    const problem = timeProblem(date, start);
    if (problem) add("start", problem);
  }
  if (end === null) add("end", messages.end);
  else if (date !== null) {
    const problem = timeProblem(date, end);
    if (problem) add("end", problem);
  }
  if (start !== null && end !== null && end <= start) add("range", messages.range);

  if (issues.length === 0 && date !== null && start !== null && end !== null) {
    return { issues, parsed: { date, start, end } };
  }
  return { issues };
}

const overlaps = (a: Omit<CompleteSlot, "index">, b: Omit<CompleteSlot, "index">) =>
  a.date === b.date && a.start < b.end && b.start < a.end;

function createTerminSchema(now: Date = new Date()) {
  return z
    .object({
      aktenzeichen: z
        .string()
        .trim()
        .min(1, messages.aktenzeichenRequired)
        .max(MAX_AKTENZEICHEN_LENGTH, messages.aktenzeichenTooLong),
      slots: z.array(SlotInputSchema),
    })
    .superRefine(({ slots }, ctx) => {
      let rowErrors = 0;
      const complete: CompleteSlot[] = [];
      slots.forEach((slot, index) => {
        if (isEmptySlot(slot)) return;
        const { issues, parsed } = checkSlot(slot, now);
        for (const { group, message } of issues) {
          rowErrors += 1;
          ctx.addIssue({ code: "custom", path: ["slots", index, group], message });
        }
        if (parsed) complete.push({ index, ...parsed });
      });

      // Windows that merely touch (one ends when the next starts) are fine.
      complete.forEach((slot, position) => {
        const earlier = complete.slice(0, position).find((other) => overlaps(other, slot));
        if (earlier) {
          rowErrors += 1;
          ctx.addIssue({
            code: "custom",
            path: ["slots", slot.index, "overlap"],
            message: messages.overlap(earlier.index + 1),
          });
        }
      });

      if (slots.length > MAX_SLOTS) {
        ctx.addIssue({ code: "custom", path: ["slots"], message: messages.tooManySlots });
      } else if (rowErrors === 0 && complete.length < MIN_SLOTS) {
        // Row errors come first; the count only matters once every filled row is valid.
        ctx.addIssue({ code: "custom", path: ["slots"], message: messages.tooFewSlots });
      }
    });
}

// Saving a draft only needs the Aktenzeichen to fit; "Weiter" also needs it to be filled in.
export function aktenzeichenProblem(value: string, { required }: { required: boolean }) {
  const trimmed = value.trim();
  if (trimmed.length > MAX_AKTENZEICHEN_LENGTH) return messages.aktenzeichenTooLong;
  if (required && trimmed.length === 0) return messages.aktenzeichenRequired;
  return undefined;
}

export type CreateTerminValues = { aktenzeichen: string; slots: SlotInput[] };

export type CreateTerminErrors = {
  aktenzeichen?: string;
  slots?: string;
  // Keyed by row index, then by the part of the row the message belongs to.
  rows: Record<number, Partial<Record<SlotErrorGroup, string>>>;
};

export function parseSlotForm(form: FormData): SlotInput {
  const slot = { ...emptySlot };
  for (const field of slotFields) {
    const value = form.get(field);
    if (typeof value === "string") slot[field] = value;
  }
  return slot;
}

export function validateCreateTermin(
  values: CreateTerminValues,
  now?: Date,
): { success: true } | { success: false; errors: CreateTerminErrors } {
  const result = createTerminSchema(now).safeParse(values);
  if (result.success) return { success: true };

  const errors: CreateTerminErrors = { rows: {} };
  for (const issue of result.error.issues) {
    const [first, index, group] = issue.path;
    if (first === "aktenzeichen") errors.aktenzeichen ??= issue.message;
    else if (first === "slots" && index === undefined) errors.slots ??= issue.message;
    else if (first === "slots" && typeof index === "number") {
      (errors.rows[index] ??= {})[group as SlotErrorGroup] ??= issue.message;
    }
  }
  return { success: false, errors };
}

export type SlotErrors = Partial<Record<SlotErrorGroup, string>>;

const twoDigits = (value: number) => String(value).padStart(2, "0");
const clock = (minutes: number) =>
  `${twoDigits(Math.floor(minutes / 60))}:${twoDigits(minutes % 60)}`;

// "am 17. September 2026, 10:00 bis 14:00"
function describeComplete({ date, start, end }: Omit<CompleteSlot, "index">): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return `am ${formatCalendarDate(year, month, day)}, ${clock(start)} bis ${clock(end)}`;
}

// Checks the one slot that is being added or changed, against the other slots of the draft.
export function validateSlot(
  slot: SlotInput,
  others: SlotInput[],
  now: Date = new Date(),
): { success: true } | { success: false; errors: SlotErrors } {
  const { issues, parsed } = checkSlot(slot, now);
  const errors: SlotErrors = {};
  for (const { group, message } of issues) errors[group] ??= message;

  if (parsed) {
    for (const other of others) {
      const { parsed: otherParsed } = checkSlot(other, new Date(0));
      if (otherParsed && overlaps(otherParsed, parsed)) {
        errors.overlap = messages.overlapWith(describeComplete(otherParsed));
        break;
      }
    }
  }
  return Object.keys(errors).length === 0 ? { success: true } : { success: false, errors };
}
