import { formatCalendarDate } from "~/core/domain/time/format";

import { isEmptySlot, type SlotInput } from "./schema";

const pad = (value: string) => value.padStart(2, "0");

export type DayWindows = { key: string; label: string; times: string[] };

// Expects slots that passed validation. Windows on the same day share one entry.
export function groupSlotsByDay(slots: SlotInput[]): DayWindows[] {
  const windows = slots
    .filter((slot) => !isEmptySlot(slot))
    .map((slot) => {
      const key = `${slot.year}-${pad(slot.month)}-${pad(slot.day)}`;
      const start = `${pad(slot.startHour)}:${pad(slot.startMinute)}`;
      const end = `${pad(slot.endHour)}:${pad(slot.endMinute)}`;
      const label = formatCalendarDate(Number(slot.year), Number(slot.month), Number(slot.day));
      return { key, label, start, time: `${start} bis ${end}` };
    })
    .sort((a, b) => a.key.localeCompare(b.key) || a.start.localeCompare(b.start));

  const days: DayWindows[] = [];
  for (const { key, label, time } of windows) {
    const last = days.at(-1);
    if (last?.key === key) last.times.push(time);
    else days.push({ key, label, times: [time] });
  }
  return days;
}
