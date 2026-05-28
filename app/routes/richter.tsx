import { type ComponentProps, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { requireRole } from "~/adapters/session/session";
import {
  authService,
  DEFAULT_CASE_ID,
  schedulingQuery,
  schedulingService,
} from "~/bootstrap";
import type { SlotDraft } from "~/components/richterHelpers";
import { createEmptyDraft, toIsoSlotRanges } from "~/components/richterHelpers";
import {
  appendRandomSlots,
  DraftSlotsSection,
  PartyAccessSection,
  RichterSummarySection,
  SlotsTableSection,
} from "~/components/RichterSections";
import {
  formatSlotRange,
  RouteErrorBoundary,
  Shell,
} from "~/components/shared/SchedulingShared";
import type { OverviewDto } from "~/core/services/schedulingQuery";

type RichterActionIntent =
  | "setSlots"
  | "deleteSlot"
  | "deleteAllSlots"
  | "confirmSlot"
  | "unlock";

type ActionResult = { error: string } | null;

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, authService, "RICHTER");
  const overview = schedulingQuery.getOverview(DEFAULT_CASE_ID);
  return { user, overview };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = parseRichterActionIntent(formData.get("intent"));
  if (!intent) {
    return null;
  }

  try {
    return executeActionIntent(intent, formData);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unexpected action error.",
    };
  }
}

export function meta() {
  return [{ title: "Richter - Court Appointment Scheduling" }];
}

export default function RichterRoute() {
  const { user, overview } = useLoaderData<typeof loader>();
  const slotFetcher = useFetcher<typeof action>();

  const fetcherError =
    slotFetcher.data && "error" in slotFetcher.data
      ? slotFetcher.data.error
      : null;

  const [draft, setDraft] = useState<SlotDraft>(createEmptyDraft);
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>([]);

  const finalSlotLabel = getFinalSlotLabel(overview);

  const addDraftSlot: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setSlotDrafts((current) => [...current, draft]);
    setDraft(createEmptyDraft());
  };

  function removeDraftSlot(index: number) {
    setSlotDrafts((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function saveSlots() {
    const slots = toIsoSlotRanges(slotDrafts);
    setSlotDrafts([]);
    slotFetcher.submit(
      { intent: "setSlots", slots: JSON.stringify(slots) },
      { method: "post" },
    );
  }

  return (
    <Shell title="Richter - Management" user={user}>
      <RichterSummarySection
        caseName={overview.name}
        finalSlotText={finalSlotLabel}
      />
      <div className="grid grid-cols-2">
        <DraftSlotsSection
          draft={draft}
          error={fetcherError}
          onAddDraft={addDraftSlot}
          onRemoveDraft={removeDraftSlot}
          onSaveDrafts={saveSlots}
          onSuggestRandom={() =>
            setSlotDrafts((current) => appendRandomSlots(current))
          }
          setDraft={setDraft}
          slotDrafts={slotDrafts}
        />
        <PartyAccessSection overview={overview} />
      </div>
      <SlotsTableSection overview={overview} />
    </Shell>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary title="Richter - Management" />;
}

function parseRichterActionIntent(
  value: FormDataEntryValue | null,
): RichterActionIntent | null {
  if (value === "setSlots") {
    return "setSlots";
  }
  if (value === "deleteSlot") {
    return "deleteSlot";
  }
  if (value === "deleteAllSlots") {
    return "deleteAllSlots";
  }
  if (value === "confirmSlot") {
    return "confirmSlot";
  }
  if (value === "unlock") {
    return "unlock";
  }
  return null;
}

function executeActionIntent(
  intent: RichterActionIntent,
  formData: FormData,
): ActionResult {
  if (intent === "setSlots") return handleSetSlots(formData);
  if (intent === "deleteSlot") return handleDeleteSlot(formData);
  if (intent === "deleteAllSlots") return handleDeleteAllSlots();
  if (intent === "confirmSlot") return handleConfirmSlot(formData);
  if (intent === "unlock") return handleUnlock(formData);
  return null;
}

function handleSetSlots(formData: FormData): ActionResult {
  const slotsEntry = formData.get("slots");
  if (slotsEntry !== null && typeof slotsEntry !== "string") {
    return { error: "Invalid slot data." };
  }
  const slotsJson = slotsEntry ?? "[]";
  let slotRanges: Array<{ startsAtIso: string; endsAtIso: string }>;
  try {
    slotRanges = JSON.parse(slotsJson) as Array<{
      startsAtIso: string;
      endsAtIso: string;
    }>;
  } catch {
    return { error: "Invalid slot data." };
  }
  schedulingService.richterSetSlots(DEFAULT_CASE_ID, slotRanges);
  return null;
}

function handleDeleteSlot(formData: FormData): ActionResult {
  const slotIdEntry = formData.get("slotId");
  if (slotIdEntry !== null && typeof slotIdEntry !== "string") {
    return { error: "Invalid slot id." };
  }
  schedulingService.richterDeleteSlot(DEFAULT_CASE_ID, slotIdEntry ?? "");
  return null;
}

function handleDeleteAllSlots(): ActionResult {
  schedulingService.richterDeleteAllSlots(DEFAULT_CASE_ID);
  return null;
}

function handleConfirmSlot(formData: FormData): ActionResult {
  const slotIdEntry = formData.get("slotId");
  if (slotIdEntry !== null && typeof slotIdEntry !== "string") {
    return { error: "Invalid slot id." };
  }
  schedulingService.richterConfirmSlot(DEFAULT_CASE_ID, slotIdEntry ?? "");
  return null;
}

function handleUnlock(formData: FormData): ActionResult {
  const partyRoleEntry = formData.get("partyRole");
  if (partyRoleEntry !== "KLAEGER" && partyRoleEntry !== "BEKLAGTER") {
    return { error: "Invalid party role." };
  }
  schedulingService.richterUnlockSubmission(DEFAULT_CASE_ID, partyRoleEntry);
  return null;
}

function getFinalSlotLabel(overview: OverviewDto): string {
  const finalSlot = overview.slots.find(
    (slot) => slot.id === overview.finalSlotId,
  );
  if (!finalSlot) {
    return "None yet";
  }

  return formatSlotRange(finalSlot.startsAtIso, finalSlot.endsAtIso);
}
