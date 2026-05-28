export const PARTY_ROLES = ["KLAEGER", "BEKLAGTER"] as const;

export type PartyRole = (typeof PARTY_ROLES)[number];
export type Role = "RICHTER" | PartyRole;

export type Decision = "ACCEPT" | "REJECT";

export interface TimeSlot {
  id: string;
  startsAtIso: string;
  endsAtIso: string;
}

export interface Verfahren {
  id: string;
  name: string;
  slots: TimeSlot[];
  decisionsByParty: Record<PartyRole, Record<string, Decision>>;
  hasSubmitted: Record<PartyRole, boolean>;
  confirmedSlotId: string | null;
}

export interface SlotDecisionStatus {
  slotId: string;
  klaegerDecision: Decision | null;
  beklagterDecision: Decision | null;
  isMutuallyAccepted: boolean;
}
