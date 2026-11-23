import {
  checkAvailability,
  remainingWindows,
  type Slot,
  type SlotAnswer,
  type SlotWindow,
} from "./availability.ts";

// Where a Terminumfrage stands when a guest sends an answer, read under the lock on its row.
export type SurveyState = {
  // Only an open Terminumfrage takes answers.
  open: boolean;
  // A personal link answers once. False behind the universal link, which always starts a new
  // participant, and true for a personal link of another Terminumfrage.
  alreadyAnswered: boolean;
  minDurationMinutes: number | null;
  // Every proposed slot.
  slots: Slot[];
  // The answers of the other participants.
  answers: SlotAnswer[];
};

export type AnswerRejection = "closed" | "answered" | "unavailable";

export type AcceptedAnswer = {
  // One per slot that still had a remaining window: whether the guest is available in it. Slots
  // already ruled out get no answer.
  responses: Array<{ slotId: string; available: boolean }>;
  // The availability windows, merged per slot.
  windows: SlotWindow[];
  // What later guests are still offered, sorted by start.
  remaining: SlotWindow[];
  // Without a remaining window nobody can attend, and the Terminumfrage is off.
  cancelled: boolean;
};

// Whether the answer is taken and, if it is, what it leaves of the slots. A guest is offered what
// the other answers leave of the slots. The availability windows have to lie within those offered
// windows; a slot without one is answered with "not available".
export function stateAfterAnswer(
  state: SurveyState,
  availability: SlotWindow[],
): { ok: true; answer: AcceptedAnswer } | { ok: false; reason: AnswerRejection } {
  if (!state.open) return { ok: false, reason: "closed" };
  if (state.alreadyAnswered) return { ok: false, reason: "answered" };

  const offered = remainingWindows(state.slots, state.answers, state.minDurationMinutes);
  const checked = checkAvailability(availability, offered, state.minDurationMinutes);
  if (!checked.ok) return { ok: false, reason: "unavailable" };

  const slotIds = [...new Set(offered.map(({ slotId }) => slotId))];
  const answers: SlotAnswer[] = slotIds.map((slotId) => ({
    slotId,
    windows: checked.windows
      .filter((window) => window.slotId === slotId)
      .map(({ start, end }) => ({ start, end })),
  }));
  const remaining = remainingWindows(
    state.slots,
    [...state.answers, ...answers],
    state.minDurationMinutes,
  );

  return {
    ok: true,
    answer: {
      responses: answers.map(({ slotId, windows }) => ({ slotId, available: windows.length > 0 })),
      windows: checked.windows,
      remaining,
      cancelled: remaining.length === 0,
    },
  };
}
