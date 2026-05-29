import { type SyntheticEvent, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { requireRole } from "~/adapters/session/session";
import {
  authService,
  DEFAULT_CASE_ID,
  schedulingQuery,
  schedulingService,
} from "~/bootstrap";
import type { SlotDraft } from "~/components/richter/richterHelpers";
import {
  createEmptyDraft,
  toIsoSlotRanges,
} from "~/components/richter/richterHelpers";
import { RichterProcessSection } from "~/components/richter/RichterProcessSection";
import {
  appendRandomSlots,
  DraftSlotsSection,
  PartyAccessSection,
  SlotsTableSection,
} from "~/components/richter/RichterSections";
import {
  RouteErrorBoundary,
  Shell,
} from "~/components/shared/SchedulingShared";
import {
  ConfirmSlotPayloadSchema,
  DeleteSlotPayloadSchema,
  RichterActionIntentSchema,
  SetSlotsPayloadSchema,
  UnlockPayloadSchema,
  type RichterActionIntent,
} from "~/routes/richter.schema";

type ActionResult = { error: string } | null;

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, authService, "RICHTER");
  const overview = schedulingQuery.getOverview(DEFAULT_CASE_ID);
  return { user, overview };
}

export async function action({ request }: { request: Request }) {
  const raw = Object.fromEntries(await request.formData());
  const intentResult = RichterActionIntentSchema.safeParse(raw.intent);
  if (!intentResult.success) return null;

  try {
    return executeActionIntent(intentResult.data, raw);
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

  const addDraftSlot = (event: SyntheticEvent) => {
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
      <RichterProcessSection overview={overview} />
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

function executeActionIntent(
  intent: RichterActionIntent,
  raw: Record<string, FormDataEntryValue>,
): ActionResult {
  if (intent === "setSlots") return handleSetSlots(raw);
  if (intent === "deleteSlot") return handleDeleteSlot(raw);
  if (intent === "deleteAllSlots") return handleDeleteAllSlots();
  if (intent === "confirmSlot") return handleConfirmSlot(raw);
  if (intent === "unlock") return handleUnlock(raw);
  return null;
}

function handleSetSlots(raw: Record<string, FormDataEntryValue>): ActionResult {
  const result = SetSlotsPayloadSchema.safeParse(raw);
  if (!result.success) return { error: "Invalid slot data." };
  schedulingService.richterSetSlots(DEFAULT_CASE_ID, result.data.slots);
  return null;
}

function handleDeleteSlot(
  raw: Record<string, FormDataEntryValue>,
): ActionResult {
  const result = DeleteSlotPayloadSchema.safeParse(raw);
  if (!result.success) return { error: "Invalid slot id." };
  schedulingService.richterDeleteSlot(DEFAULT_CASE_ID, result.data.slotId);
  return null;
}

function handleDeleteAllSlots(): ActionResult {
  schedulingService.richterDeleteAllSlots(DEFAULT_CASE_ID);
  return null;
}

function handleConfirmSlot(
  raw: Record<string, FormDataEntryValue>,
): ActionResult {
  const result = ConfirmSlotPayloadSchema.safeParse(raw);
  if (!result.success) return { error: "Invalid slot id." };
  schedulingService.richterConfirmSlot(DEFAULT_CASE_ID, result.data.slotId);
  return null;
}

function handleUnlock(raw: Record<string, FormDataEntryValue>): ActionResult {
  const result = UnlockPayloadSchema.safeParse(raw);
  if (!result.success) return { error: "Invalid party role." };
  schedulingService.richterUnlockSubmission(DEFAULT_CASE_ID, result.data.partyRole);
  return null;
}
