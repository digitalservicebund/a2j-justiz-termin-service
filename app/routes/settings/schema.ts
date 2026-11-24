import {
  findOverlap,
  isWeekday,
  type SitzungstagTimes,
  type Weekday,
} from "~/core/domain/sitzungstag";
import { formatIsoWeekday, formatTimeOfDay } from "~/core/domain/time/format";
import { hourOf, minuteOf, parseTimeOfDay } from "~/core/domain/time/time-of-day";

export const messages = {
  weekday: "Wählen Sie einen Sitzungstag aus.",
  start: "Geben Sie eine gültige Startzeit an.",
  end: "Geben Sie eine gültige Endzeit an.",
  range: "Die Endzeit muss nach der Startzeit liegen.",
  overlap: (other: string) => `Dieser Sitzungstag überschneidet sich mit ${other}.`,
};

const fields = ["weekday", "startHour", "startMinute", "endHour", "endMinute"] as const;

export type SitzungstagField = (typeof fields)[number];
// What the form holds, as typed.
export type SitzungstagInput = Record<SitzungstagField, string>;

// The part of the form an error belongs to. "range" covers the start/end pair and "overlap" the
// whole entry.
export type SitzungstagErrorGroup = "weekday" | "start" | "end" | "range" | "overlap";
export type SitzungstagErrors = Partial<Record<SitzungstagErrorGroup, string>>;

export const emptySitzungstag: SitzungstagInput = {
  weekday: "",
  startHour: "",
  startMinute: "",
  endHour: "",
  endMinute: "",
};

export function parseSitzungstagForm(form: FormData): SitzungstagInput {
  const input = { ...emptySitzungstag };
  for (const field of fields) {
    const value = form.get(field);
    if (typeof value === "string") input[field] = value.trim();
  }
  return input;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

// A saved Sitzungstag as the form shows it.
export const toSitzungstagInput = ({
  weekday,
  start,
  end,
}: SitzungstagTimes): SitzungstagInput => ({
  weekday: String(weekday),
  startHour: twoDigits(hourOf(start)),
  startMinute: twoDigits(minuteOf(start)),
  endHour: twoDigits(hourOf(end)),
  endMinute: twoDigits(minuteOf(end)),
});

// "Dienstag, 09:00 bis 12:00"
export const describeSitzungstag = ({ weekday, start, end }: SitzungstagTimes) =>
  `${formatIsoWeekday(weekday)}, ${formatTimeOfDay(start)} bis ${formatTimeOfDay(end)}`;

function parseWeekday(value: string): Weekday | null {
  if (!/^\d$/.test(value)) return null;
  const weekday = Number(value);
  return isWeekday(weekday) ? weekday : null;
}

// Checks the Sitzungstag that is being added or changed, also against the judge's other ones.
export function validateSitzungstag(
  input: SitzungstagInput,
  others: readonly SitzungstagTimes[],
): { success: true; times: SitzungstagTimes } | { success: false; errors: SitzungstagErrors } {
  const errors: SitzungstagErrors = {};
  const weekday = parseWeekday(input.weekday);
  const start = parseTimeOfDay(input.startHour, input.startMinute);
  const end = parseTimeOfDay(input.endHour, input.endMinute);

  if (weekday === null) errors.weekday = messages.weekday;
  if (start === null) errors.start = messages.start;
  if (end === null) errors.end = messages.end;
  if (start !== null && end !== null && end <= start) errors.range = messages.range;
  if (weekday === null || start === null || end === null || errors.range) {
    return { success: false, errors };
  }

  const times = { weekday, start, end };
  const overlap = findOverlap(times, others);
  if (overlap) {
    return { success: false, errors: { overlap: messages.overlap(describeSitzungstag(overlap)) } };
  }
  return { success: true, times };
}
