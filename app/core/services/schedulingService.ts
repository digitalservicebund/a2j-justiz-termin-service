import { z } from "zod";
import type { Decision, PartyRole, Verfahren } from "../domain/verfahren";
import { DecisionSchema, PARTY_ROLES, TimeSlotsSchema } from "../domain/verfahren";
import type { VerfahrenRepository } from "../ports/verfahrenRepository";

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
    const slotsResult = TimeSlotsSchema.safeParse(slots);
    if (!slotsResult.success) throw new TypeError(slotsResult.error.issues[0].message);
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
    const slotIds = new Set(c.slots.map((s) => s.id));
    const DecisionMapSchema = z.record(z.string(), DecisionSchema).refine(
      (map) =>
        Object.keys(map).length === c.slots.length &&
        Object.keys(map).every((id) => slotIds.has(id)),
      { message: "Please accept or reject every time slot." },
    );
    const mapResult = DecisionMapSchema.safeParse(decisionMap);
    if (!mapResult.success) throw new TypeError(mapResult.error.issues[0].message);
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
