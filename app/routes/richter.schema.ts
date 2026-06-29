import { z } from "zod";
import { PartyRoleSchema } from "~/core/domain/verfahren";

export const RichterActionIntentSchema = z.enum([
  "setSlots",
  "deleteSlot",
  "deleteAllSlots",
  "confirmSlot",
  "unlock",
]);
export type RichterActionIntent = z.infer<typeof RichterActionIntentSchema>;

const SlotRangeSchema = z.object({
  startsAtIso: z.string(),
  endsAtIso: z.string(),
});

export const SetSlotsPayloadSchema = z.object({
  intent: z.literal("setSlots"),
  slots: z
    .string()
    .transform((s) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        throw new Error("Invalid JSON");
      }
    })
    .pipe(z.array(SlotRangeSchema)),
});

export const DeleteSlotPayloadSchema = z.object({
  intent: z.literal("deleteSlot"),
  slotId: z.string().min(1),
});

export const ConfirmSlotPayloadSchema = z.object({
  intent: z.literal("confirmSlot"),
  slotId: z.string().min(1),
});

export const UnlockPayloadSchema = z.object({
  intent: z.literal("unlock"),
  partyRole: PartyRoleSchema,
});
