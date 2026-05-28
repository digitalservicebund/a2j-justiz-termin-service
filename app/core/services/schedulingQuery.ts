import type {
  PartyRole,
  SlotDecisionStatus,
  TimeSlot,
  Verfahren,
} from "../domain/verfahren";
import type { VerfahrenRepository } from "../ports/verfahrenRepository";

function buildSlotStatuses(c: Verfahren): SlotDecisionStatus[] {
  return c.slots.map((slot) => {
    const klaegerDecision = c.decisionsByParty.KLAEGER[slot.id] ?? null;
    const beklagterDecision = c.decisionsByParty.BEKLAGTER[slot.id] ?? null;
    return {
      slotId: slot.id,
      klaegerDecision,
      beklagterDecision,
      isMutuallyAccepted:
        klaegerDecision === "ACCEPT" && beklagterDecision === "ACCEPT",
    };
  });
}

export interface AppointmentQueries {
  getOverview(verfahrenId: string): OverviewDto;
}

export interface OverviewDto {
  id: string;
  name: string;
  slots: TimeSlot[];
  statuses: SlotDecisionStatus[];
  finalSlotId: string | null;
  hasSubmitted: Record<PartyRole, boolean>;
}

export class SchedulingQuery implements AppointmentQueries {
  constructor(private readonly store: VerfahrenRepository) {}

  getOverview(verfahrenId: string): OverviewDto {
    const c = this.store.getById(verfahrenId);
    if (!c) throw new Error("Case not found.");
    return {
      id: c.id,
      name: c.name,
      slots: c.slots,
      statuses: buildSlotStatuses(c),
      finalSlotId: c.confirmedSlotId,
      hasSubmitted: { ...c.hasSubmitted },
    };
  }
}
