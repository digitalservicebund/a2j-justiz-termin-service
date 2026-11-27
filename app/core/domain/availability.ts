import type { TimeRange } from "./time/time-range.ts";

// The vocabulary, see "Glossary" in the README:
// - slot: a Zeitfenster the judge proposed.
// - availability window: a range a guest is available in. It lies within a slot.
// - remaining window: what is left of a slot once every answer is taken into account.

// A range that belongs to a slot: an availability window or a remaining window.
export type SlotWindow = TimeRange & { slotId: string };

// A proposed time slot. Its id stays the same as long as the slot is not replaced.
export type Slot = TimeRange & { id: string };

// What one participant answered for one slot. No windows means "not available".
export type SlotAnswer = { slotId: string; windows: TimeRange[] };

const MINUTE = 60_000;

const length = ({ start, end }: TimeRange) => end.getTime() - start.getTime();

const byStart = (a: TimeRange, b: TimeRange) => a.start.getTime() - b.start.getTime();

// A missing minimum duration only asks for a window that has a length at all.
export const isLongEnough = (range: TimeRange, minDurationMinutes?: number | null) =>
  length(range) > 0 && length(range) >= (minDurationMinutes ?? 0) * MINUTE;

export const contains = (outer: TimeRange, inner: TimeRange) =>
  outer.start.getTime() <= inner.start.getTime() && inner.end.getTime() <= outer.end.getTime();

// Sorted and disjoint: ranges that overlap or touch become one. Empty ranges are dropped.
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const merged: TimeRange[] = [];
  for (const range of ranges.filter((r) => length(r) > 0).sort(byStart)) {
    const last = merged.at(-1);
    if (last && range.start.getTime() <= last.end.getTime()) {
      if (range.end.getTime() > last.end.getTime()) last.end = new Date(range.end);
    } else {
      merged.push({ start: new Date(range.start), end: new Date(range.end) });
    }
  }
  return merged;
}

// The times that lie in a range of both lists.
export function intersectRanges(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  const result: TimeRange[] = [];
  for (const x of mergeRanges(a)) {
    for (const y of mergeRanges(b)) {
      const start = Math.max(x.start.getTime(), y.start.getTime());
      const end = Math.min(x.end.getTime(), y.end.getTime());
      if (start < end) result.push({ start: new Date(start), end: new Date(end) });
    }
  }
  return result;
}

// The same windows per slot, merged where they overlap or touch, sorted by start.
export function mergeWindows(windows: SlotWindow[]): SlotWindow[] {
  const bySlot = new Map<string, TimeRange[]>();
  for (const { slotId, start, end } of windows) {
    bySlot.set(slotId, [...(bySlot.get(slotId) ?? []), { start, end }]);
  }
  return [...bySlot]
    .flatMap(([slotId, ranges]) => mergeRanges(ranges).map((range) => ({ slotId, ...range })))
    .sort(byStart);
}

// What is left of every slot: the times at which everyone who answered for the slot is available,
// in stretches long enough for the appointment. A slot nobody answered is left whole; a slot one
// participant cannot attend at all leaves nothing. Sorted by start.
export function remainingWindows(
  slots: Slot[],
  answers: SlotAnswer[],
  minDurationMinutes?: number | null,
): SlotWindow[] {
  return slots
    .flatMap((slot) => {
      const remaining = answers
        .filter(({ slotId }) => slotId === slot.id)
        .reduce<TimeRange[]>(
          (left, { windows }) => intersectRanges(left, windows),
          [{ start: slot.start, end: slot.end }],
        );
      return remaining
        .filter((range) => isLongEnough(range, minDurationMinutes))
        .map((range) => ({ slotId: slot.id, ...range }));
    })
    .sort(byStart);
}

export type AvailabilityProblem = "outside" | "tooShort";

// An answer has to fit what is offered: every availability window lies within one remaining window
// of its slot and is long enough for the appointment. Returns the first problem, or the windows
// merged per slot.
export function checkAvailability(
  windows: SlotWindow[],
  offered: SlotWindow[],
  minDurationMinutes?: number | null,
): { ok: true; windows: SlotWindow[] } | { ok: false; problem: AvailabilityProblem } {
  const merged = mergeWindows(windows);
  for (const window of merged) {
    const fits = offered.some((offer) => offer.slotId === window.slotId && contains(offer, window));
    if (!fits) return { ok: false, problem: "outside" };
    if (!isLongEnough(window, minDurationMinutes)) return { ok: false, problem: "tooShort" };
  }
  return { ok: true, windows: merged };
}

// Names a window in forms and URLs. It carries the times, not only the slot, so a window that
// changed between two requests is no longer found instead of standing for something else.
export const windowKey = ({ slotId, start, end }: SlotWindow) =>
  `${slotId}_${start.getTime()}_${end.getTime()}`;

export function parseWindowKey(key: string): SlotWindow | undefined {
  const match = /^(.+)_(\d{1,15})_(\d{1,15})$/.exec(key);
  if (!match) return undefined;
  const start = new Date(Number(match[2]));
  const end = new Date(Number(match[3]));
  if (end.getTime() <= start.getTime()) return undefined;
  return { slotId: match[1]!, start, end };
}

// How an answer relates to one remaining window that was offered: available for all of it, for
// parts of it, or not at all.
export type OfferAnswer = {
  offer: SlotWindow;
  state: "full" | "partial" | "none";
  // The availability windows within the offer, sorted by start.
  windows: SlotWindow[];
};

export function answersByOffer(offered: SlotWindow[], availability: SlotWindow[]): OfferAnswer[] {
  const merged = mergeWindows(availability);
  return offered.map((offer) => {
    const windows = merged.filter(
      (window) => window.slotId === offer.slotId && contains(offer, window),
    );
    const full = windows.some((window) => contains(window, offer));
    return { offer, state: full ? "full" : windows.length > 0 ? "partial" : "none", windows };
  });
}

// What one participant answered for a slot. `windows` says when the participant is available in
// it; without any, the participant is not available.
export type SlotResponse = {
  participantId: string;
  name: string;
  available: boolean;
  windows: TimeRange[];
};

// A proposed slot with the answers given for it and what they leave of it. A participant who could
// no longer see the slot when answering has no answer for it.
export type AnsweredSlot = Slot & {
  responses: SlotResponse[];
  // The remaining windows of the slot, sorted by start. Empty once the slot is ruled out.
  remaining: TimeRange[];
};

export type Availability = {
  minDurationMinutes: number | null;
  // Sorted by start.
  slots: AnsweredSlot[];
};

// The remaining windows of all slots, sorted by start.
export const remainingOf = ({ slots }: Pick<Availability, "slots">): SlotWindow[] =>
  slots.flatMap(({ id, remaining }) => remaining.map((range) => ({ slotId: id, ...range })));

export function toAnsweredSlot(
  slot: Slot,
  responses: SlotResponse[],
  minDurationMinutes: number | null = null,
): AnsweredSlot {
  const remaining = remainingWindows(
    [slot],
    responses.map(({ windows }) => ({ slotId: slot.id, windows })),
    minDurationMinutes,
  ).map(({ start, end }) => ({ start, end }));
  return { ...slot, responses, remaining };
}

// Where an appointment stands after the latest answer, for the calendar file that goes to the
// judge.
export type ResponseOverview = {
  appointmentId: string;
  aktenzeichen: string;
  // The code of the court in GDS.Gerichte. Older Terminumfragen have none.
  courtCode: string | null;
  // The judge who created the appointment.
  judgeEmail: string;
  // The SEQUENCE for the calendar file that goes with this state.
  calendarSequence: number;
  // Every proposed slot with the answers given for it and what is left of it.
  slots: AnsweredSlot[];
};

// An appointment in the judge's calendar feed: an open one with all its slots, or a confirmed one
// with the chosen window.
export type FeedAppointment = {
  id: string;
  aktenzeichen: string;
  // The code of the court in GDS.Gerichte. Older Terminumfragen have none.
  courtCode: string | null;
  calendarSequence: number;
  // The chosen window of a confirmed appointment, which lies within the slot `confirmedSlotId`.
  confirmed: (TimeRange & { slotId: string }) | null;
  slots: AnsweredSlot[];
};
