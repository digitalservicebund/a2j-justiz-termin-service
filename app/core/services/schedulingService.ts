import type {
  Decision,
  PartyRole,
  TimeSlot,
  Verfahren,
} from "../domain/verfahren";
import { PARTY_ROLES } from "../domain/verfahren";
import type { VerfahrenRepository } from "../ports/verfahrenRepository";

function validateSlots(slots: TimeSlot[]): void {
  if (slots.length === 0)
    throw new TypeError("At least one time slot is required.");

  const ids = new Set<string>();
  for (const slot of slots) {
    if (ids.has(slot.id))
      throw new TypeError("Each time slot must have a unique id.");
    ids.add(slot.id);
    const start = Date.parse(slot.startsAtIso);
    const end = Date.parse(slot.endsAtIso);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new TypeError("A time slot must have valid ISO date strings.");
    }
    if (start >= end) {
      throw new TypeError("A time slot must end after it starts.");
    }
  }
}

function validateDecisionMap(
  schedulingCase: Verfahren,
  decisionMap: Record<string, Decision>,
): void {
  const slotIds = new Set(schedulingCase.slots.map((s) => s.id));
  if (Object.keys(decisionMap).length !== schedulingCase.slots.length) {
    throw new TypeError("Please accept or reject every time slot.");
  }
  for (const [slotId, decision] of Object.entries(decisionMap)) {
    if (!slotIds.has(slotId))
      throw new TypeError("Unknown time slot in the submission.");
    if (decision !== "ACCEPT" && decision !== "REJECT")
      throw new TypeError("Invalid decision.");
  }
}

function createEmptyDecisionMap(): Record<PartyRole, Record<string, Decision>> {
  return { KLAEGER: {}, BEKLAGTER: {} };
}

function createHasSubmittedMap(): Record<PartyRole, boolean> {
  return { KLAEGER: false, BEKLAGTER: false };
}

export class SchedulingService {
  constructor(private readonly store: VerfahrenRepository) {}

  seedCase(verfahrenId: string, caseName: string): void {
    if (this.store.getById(verfahrenId)) return;
    this.store.save({
      id: verfahrenId,
      name: caseName,
      slots: [],
      decisionsByParty: createEmptyDecisionMap(),
      hasSubmitted: createHasSubmittedMap(),
      confirmedSlotId: null,
    });
  }

  richterSetSlots(
    verfahrenId: string,
    slotRanges: Array<{ startsAtIso: string; endsAtIso: string }>,
  ): void {
    const c = this.getRequired(verfahrenId);
    const slots = slotRanges.map((range) => ({
      id: this.store.nextId("slot"),
      startsAtIso: range.startsAtIso,
      endsAtIso: range.endsAtIso,
    }));
    validateSlots(slots);
    c.slots = slots;
    c.decisionsByParty = createEmptyDecisionMap();
    c.hasSubmitted = createHasSubmittedMap();
    c.confirmedSlotId = null;
    this.store.save(c);
  }

  richterDeleteSlot(verfahrenId: string, slotId: string): void {
    const c = this.getRequired(verfahrenId);
    if (!c.slots.some((s) => s.id === slotId))
      throw new Error("Slot not found.");
    c.slots = c.slots.filter((s) => s.id !== slotId);
    for (const role of PARTY_ROLES) {
      delete c.decisionsByParty[role][slotId];
    }
    if (c.confirmedSlotId === slotId) c.confirmedSlotId = null;
    c.hasSubmitted = createHasSubmittedMap();
    this.store.save(c);
  }

  richterDeleteAllSlots(verfahrenId: string): void {
    const c = this.getRequired(verfahrenId);
    c.slots = [];
    c.decisionsByParty = createEmptyDecisionMap();
    c.hasSubmitted = createHasSubmittedMap();
    c.confirmedSlotId = null;
    this.store.save(c);
  }

  richterConfirmSlot(verfahrenId: string, slotId: string): void {
    const c = this.getRequired(verfahrenId);
    const slot = c.slots.find((s) => s.id === slotId);
    if (!slot) throw new Error("Slot not found.");
    if (
      c.decisionsByParty.KLAEGER[slotId] !== "ACCEPT" ||
      c.decisionsByParty.BEKLAGTER[slotId] !== "ACCEPT"
    ) {
      throw new Error("Only a mutually accepted slot can be confirmed.");
    }
    c.confirmedSlotId = slotId;
    this.store.save(c);
  }

  richterUnlockSubmission(verfahrenId: string, partyRole: PartyRole): void {
    const c = this.getRequired(verfahrenId);
    c.hasSubmitted[partyRole] = false;
    c.decisionsByParty[partyRole] = {};
    c.confirmedSlotId = null;
    this.store.save(c);
  }

  partySubmitDecisions(
    verfahrenId: string,
    partyRole: PartyRole,
    decisionMap: Record<string, Decision>,
  ): void {
    const c = this.getRequired(verfahrenId);
    if (c.hasSubmitted[partyRole]) {
      throw new Error(
        "Submission is locked. The Richter must unlock it first.",
      );
    }
    if (c.slots.length === 0) throw new Error("There are no time slots yet.");
    validateDecisionMap(c, decisionMap);
    c.decisionsByParty[partyRole] = { ...decisionMap };
    c.hasSubmitted[partyRole] = true;
    this.store.save(c);
  }

  private getRequired(verfahrenId: string): Verfahren {
    const c = this.store.getById(verfahrenId);
    if (!c) throw new Error("Case not found.");
    return c;
  }
}
