import { useFetcher } from "react-router";
import type { PartyRole } from "~/core/domain/verfahren";

type ActionResult = { error?: string };

export function useRichterActions() {
  const fetcher = useFetcher<ActionResult>();

  const executeAction = (intent: string, payload: Record<string, string>) => {
    fetcher.submit(
      { intent, ...payload },
      { method: "post" }
    );
  };

  const unlock = (partyRole: PartyRole) => {
    executeAction("unlock", { partyRole });
  };

  const confirmSlot = (slotId: string) => {
    executeAction("confirmSlot", { slotId });
  };

  const deleteSlot = (slotId: string) => {
    executeAction("deleteSlot", { slotId });
  };

  const deleteAllSlots = () => {
    executeAction("deleteAllSlots", {});
  };

  return {
    unlock,
    confirmSlot,
    deleteSlot,
    deleteAllSlots,
    isLoading: fetcher.state === "submitting",
    error: fetcher.data?.error || null,
    state: fetcher.state,
  };
}

