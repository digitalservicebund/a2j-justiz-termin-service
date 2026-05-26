import type { Decision } from "@/core/domain/verfahren";

export type SlotDraft = {
  startsAtLocal: string;
  endsAtLocal: string;
};

export function createEmptyDraft(): SlotDraft {
  return { startsAtLocal: "", endsAtLocal: "" };
}

export function toIsoSlotRanges(
  drafts: readonly SlotDraft[],
): Array<{ startsAtIso: string; endsAtIso: string }> {
  return drafts.map((slot) => ({
    startsAtIso: new Date(slot.startsAtLocal).toISOString(),
    endsAtIso: new Date(slot.endsAtLocal).toISOString(),
  }));
}

const MIN_DAYS_AHEAD = 7;
const MAX_ADDITIONAL_DAYS = 22;
const BUSINESS_START_HOUR = 9;
const BUSINESS_HOURS_SPAN = 7;
const MIN_DURATION_HOURS = 1;
const MAX_ADDITIONAL_DURATION_HOURS = 2;

export function generateRandomSlotDrafts(count = 3): SlotDraft[] {
  const now = new Date();
  const slots: SlotDraft[] = [];
  const usedDays = new Set<string>();

  while (slots.length < count) {
    const daysAhead = MIN_DAYS_AHEAD + Math.floor(Math.random() * MAX_ADDITIONAL_DAYS);
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysAhead);

    const dayOfWeek = candidate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const dayKey = candidate.toDateString();
    if (usedDays.has(dayKey)) {
      continue;
    }
    usedDays.add(dayKey);

    const startHour = BUSINESS_START_HOUR + Math.floor(Math.random() * BUSINESS_HOURS_SPAN);
    const durationHours = MIN_DURATION_HOURS + Math.floor(Math.random() * MAX_ADDITIONAL_DURATION_HOURS);

    const start = new Date(candidate);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(start);
    end.setHours(start.getHours() + durationHours);

    slots.push({
      startsAtLocal: toLocalDateTimeString(start),
      endsAtLocal: toLocalDateTimeString(end),
    });
  }

  return slots.sort((a, b) => a.startsAtLocal.localeCompare(b.startsAtLocal));
}

export function decisionToLabel(decision?: Decision | null): string {
  if (decision === "ACCEPT") {
    return "Accepted";
  }
  if (decision === "REJECT") {
    return "Rejected";
  }
  return "-";
}

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
