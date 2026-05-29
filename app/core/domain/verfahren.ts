import { z } from "zod";

export const PARTY_ROLES = ["KLAEGER", "BEKLAGTER"] as const;

export const PartyRoleSchema = z.enum(PARTY_ROLES);
export type PartyRole = z.infer<typeof PartyRoleSchema>;

export const RoleSchema = z.enum(["RICHTER", "KLAEGER", "BEKLAGTER"]);
export type Role = z.infer<typeof RoleSchema>;

export const DecisionSchema = z.enum(["ACCEPT", "REJECT"]);
export type Decision = z.infer<typeof DecisionSchema>;

export const TimeSlotSchema = z
  .object({
    id: z.string(),
    startsAtIso: z.iso.datetime("A time slot must have valid ISO date strings."),
    endsAtIso: z.iso.datetime("A time slot must have valid ISO date strings."),
  })
  .refine((s) => s.startsAtIso < s.endsAtIso, {
    message: "A time slot must end after it starts.",
  });
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const TimeSlotsSchema = z
  .array(TimeSlotSchema)
  .min(1, "At least one time slot is required.")
  .refine(
    (slots) => new Set(slots.map((s) => s.id)).size === slots.length,
    { message: "Each time slot must have a unique id." },
  );

export const VerfahrenSchema = z.object({
  id: z.string(),
  name: z.string(),
  slots: z.array(TimeSlotSchema),
  decisionsByParty: z.object({
    KLAEGER: z.record(z.string(), DecisionSchema),
    BEKLAGTER: z.record(z.string(), DecisionSchema),
  }),
  hasSubmitted: z.object({ KLAEGER: z.boolean(), BEKLAGTER: z.boolean() }),
  confirmedSlotId: z.string().nullable(),
});
export type Verfahren = z.infer<typeof VerfahrenSchema>;

export const SlotDecisionStatusSchema = z.object({
  slotId: z.string(),
  klaegerDecision: DecisionSchema.nullable(),
  beklagterDecision: DecisionSchema.nullable(),
  isMutuallyAccepted: z.boolean(),
});
export type SlotDecisionStatus = z.infer<typeof SlotDecisionStatusSchema>;
