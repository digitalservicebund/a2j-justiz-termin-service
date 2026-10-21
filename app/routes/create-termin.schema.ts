import { z } from "zod";

export const MIN_SLOTS = 2;
export const MAX_SLOTS = 20;
export const MAX_AKTENZEICHEN_LENGTH = 50;

export const messages = {
  aktenzeichenRequired: "Geben Sie ein Aktenzeichen an.",
  aktenzeichenTooLong: `Das Aktenzeichen darf höchstens ${MAX_AKTENZEICHEN_LENGTH} Zeichen lang sein.`,
  date: "Geben Sie ein gültiges Datum an.",
  pastDate: "Das Datum darf nicht in der Vergangenheit liegen.",
  start: "Geben Sie eine gültige Startzeit an.",
  end: "Geben Sie eine gültige Endzeit an.",
  range: "Die Endzeit muss nach der Startzeit liegen.",
  overlap: (otherRow: number) =>
    `Dieses Zeitfenster überschneidet sich mit Zeitfenster ${otherRow}.`,
  tooFewSlots: "Geben Sie mindestens zwei Zeitfenster an.",
  tooManySlots: `Geben Sie höchstens ${MAX_SLOTS} Zeitfenster an.`,
};

export const slotFields = [
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

function todayInBerlin(now: Date): string {
  // sv-SE formats as YYYY-MM-DD, which compares correctly as a string.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now);
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

type CompleteSlot = { index: number; date: string; start: number; end: number };

export function createTerminSchema(now: Date = new Date()) {
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
      const addRowIssue = (index: number, group: SlotErrorGroup, message: string) => {
        rowErrors += 1;
        ctx.addIssue({ code: "custom", path: ["slots", index, group], message });
      };

      const complete: CompleteSlot[] = [];
      slots.forEach((slot, index) => {
        if (isEmptySlot(slot)) return;
        const errorsBefore = rowErrors;

        const date = parseDate(slot);
        const start = parseMinutes(slot.startHour, slot.startMinute);
        const end = parseMinutes(slot.endHour, slot.endMinute);

        if (date === null) addRowIssue(index, "date", messages.date);
        else if (date < todayInBerlin(now)) addRowIssue(index, "date", messages.pastDate);
        if (start === null) addRowIssue(index, "start", messages.start);
        if (end === null) addRowIssue(index, "end", messages.end);
        if (start !== null && end !== null && end <= start) {
          addRowIssue(index, "range", messages.range);
        }

        if (rowErrors === errorsBefore && date !== null && start !== null && end !== null) {
          complete.push({ index, date, start, end });
        }
      });

      // Windows that merely touch (one ends when the next starts) are fine.
      complete.forEach((slot, position) => {
        const earlier = complete
          .slice(0, position)
          .find(
            (other) => other.date === slot.date && other.start < slot.end && slot.start < other.end,
          );
        if (earlier) addRowIssue(slot.index, "overlap", messages.overlap(earlier.index + 1));
      });

      if (slots.length > MAX_SLOTS) {
        ctx.addIssue({ code: "custom", path: ["slots"], message: messages.tooManySlots });
      } else if (rowErrors === 0 && complete.length < MIN_SLOTS) {
        // Row errors come first; the count only matters once every filled row is valid.
        ctx.addIssue({ code: "custom", path: ["slots"], message: messages.tooFewSlots });
      }
    });
}

export type CreateTerminValues = { aktenzeichen: string; slots: SlotInput[] };

export type CreateTerminErrors = {
  aktenzeichen?: string;
  slots?: string;
  // Keyed by row index, then by the part of the row the message belongs to.
  rows: Record<number, Partial<Record<SlotErrorGroup, string>>>;
};

const slotFieldKey = /^slots\.(\d+)\.(\w+)$/;

export function parseCreateTerminForm(form: FormData): CreateTerminValues {
  const rows = new Map<number, SlotInput>();
  for (const [key, value] of form.entries()) {
    const match = slotFieldKey.exec(key);
    if (!match || typeof value !== "string") continue;
    const field = match[2] as SlotField;
    if (!slotFields.includes(field)) continue;
    const index = Number(match[1]);
    rows.set(index, { ...(rows.get(index) ?? emptySlot), [field]: value });
  }
  const aktenzeichen = form.get("aktenzeichen");
  return {
    aktenzeichen: typeof aktenzeichen === "string" ? aktenzeichen : "",
    slots: [...rows.entries()].sort(([a], [b]) => a - b).map(([, slot]) => slot),
  };
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
