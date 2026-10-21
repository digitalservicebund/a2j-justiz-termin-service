import { z } from "zod";

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

// Part of a row an error belongs to; "range" covers the whole start/end pair.
export type SlotErrorGroup = "date" | "start" | "end" | "range";

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

export function createTerminSchema(now: Date = new Date()) {
  return z
    .object({
      aktenzeichen: z.string().trim().min(1, "Bitte geben Sie ein Aktenzeichen an."),
      slots: z.array(SlotInputSchema),
    })
    .superRefine(({ slots }, ctx) => {
      const addIssue = (index: number, group: SlotErrorGroup, message: string) =>
        ctx.addIssue({ code: "custom", path: ["slots", index, group], message });

      let filled = 0;
      slots.forEach((slot, index) => {
        if (isEmptySlot(slot)) return;
        filled += 1;

        const date = parseDate(slot);
        const start = parseMinutes(slot.startHour, slot.startMinute);
        const end = parseMinutes(slot.endHour, slot.endMinute);

        if (date === null) addIssue(index, "date", "Bitte geben Sie ein gültiges Datum an.");
        else if (date < todayInBerlin(now)) {
          addIssue(index, "date", "Das Datum darf nicht in der Vergangenheit liegen.");
        }
        if (start === null) addIssue(index, "start", "Bitte geben Sie eine gültige Startzeit an.");
        if (end === null) addIssue(index, "end", "Bitte geben Sie eine gültige Endzeit an.");
        if (start !== null && end !== null && end <= start) {
          addIssue(index, "range", "Die Endzeit muss nach der Startzeit liegen.");
        }
      });

      if (filled === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["slots"],
          message: "Bitte geben Sie mindestens ein Zeitfenster an.",
        });
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
