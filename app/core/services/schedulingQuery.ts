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

export type AppointmentQueries = {
  getOverview(verfahrenId: string): OverviewDto;
};

export type OverviewDto = {
  id: string;
  name: string;
  slots: TimeSlot[];
  statuses: SlotDecisionStatus[];
  finalSlotId: string | null;
  hasSubmitted: Record<PartyRole, boolean>;
};

export class SchedulingQuery implements AppointmentQueries {
  constructor(private readonly store: VerfahrenRepository) {}

  getOverview(verfahrenId: string): OverviewDto {
    const verfahren = this.store.getById(verfahrenId);
    if (!verfahren) throw new Error("Case not found.");
    return {
      id: verfahren.id,
      name: verfahren.name,
      slots: verfahren.slots,
      statuses: buildSlotStatuses(verfahren),
      finalSlotId: verfahren.confirmedSlotId,
      hasSubmitted: { ...verfahren.hasSubmitted },
    };
  }
}
