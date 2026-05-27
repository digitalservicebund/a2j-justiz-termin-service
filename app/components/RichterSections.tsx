import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { OverviewDto } from "~/core/services/schedulingQuery";
import type { Decision, PartyRole } from "~/core/domain/verfahren";
import { formatSlotRange, InlineError } from "~/components/shared/SchedulingShared";
import {
  generateRandomSlotDrafts,
  type SlotDraft,
} from "~/components/richterHelpers";
import { useRichterActions } from "~/hooks/useRichterActions";

export function RichterSummarySection({
  caseName,
  finalSlotText,
}: {
  readonly caseName: string;
  readonly finalSlotText: string;
}) {
  return (
    // Supporting: card layout
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start justify-between gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Case</p>
        <h2 className="kern-heading-medium">{caseName}</h2>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Final appointment
        </p>
        <p className="text-sm font-medium text-slate-700">{finalSlotText}</p>
      </div>
    </section>
  );
}

export function DraftSlotsSection({
  draft,
  setDraft,
  slotDrafts,
  onAddDraft,
  onRemoveDraft,
  onSuggestRandom,
  onSaveDrafts,
  error,
}: {
  readonly draft: SlotDraft;
  readonly setDraft: Dispatch<SetStateAction<SlotDraft>>;
  readonly slotDrafts: readonly SlotDraft[];
  readonly onAddDraft: NonNullable<ComponentProps<"form">["onSubmit"]>;
  readonly onRemoveDraft: (index: number) => void;
  readonly onSuggestRandom: () => void;
  readonly onSaveDrafts: () => void;
  readonly error: string | null;
}) {
  return (
    // Supporting: card container
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h3 className="kern-heading-small">Prepare new time slots</h3>

      <form className="flex flex-wrap gap-4 items-end" onSubmit={onAddDraft}>
        <div className="kern-form-input">
          <label className="kern-label" htmlFor="starts-at">
            Start time
          </label>
          <input
            className="kern-form-input__input"
            id="starts-at"
            type="datetime-local"
            required
            value={draft.startsAtLocal}
            onChange={(event) =>
              setDraft((current) => ({ ...current, startsAtLocal: event.target.value }))
            }
          />
        </div>
        <div className="kern-form-input">
          <label className="kern-label" htmlFor="ends-at">
            End time
          </label>
          <input
            className="kern-form-input__input"
            id="ends-at"
            type="datetime-local"
            required
            value={draft.endsAtLocal}
            onChange={(event) =>
              setDraft((current) => ({ ...current, endsAtLocal: event.target.value }))
            }
          />
        </div>
        <button className="kern-btn kern-btn--secondary" type="submit">
          <span className="kern-label">Add slot</span>
        </button>
      </form>

      {/* Supporting: staged slots list */}
      {slotDrafts.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-slate-50 overflow-hidden">
          {slotDrafts.map((slot, index) => (
            <li
              key={`${slot.startsAtLocal}-${slot.endsAtLocal}-${index}`}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm text-slate-700">
                {new Date(slot.startsAtLocal).toLocaleString("de-DE")} –{" "}
                {new Date(slot.endsAtLocal).toLocaleString("de-DE")}
              </span>
              <button
                className="kern-btn kern-btn--tertiary kern-btn--x-small"
                onClick={() => onRemoveDraft(index)}
                type="button"
              >
                <span className="kern-icon kern-icon--delete" aria-hidden="true" />
                <span className="kern-label kern-sr-only">Remove</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="kern-btn kern-btn--secondary" onClick={onSuggestRandom} type="button">
          <span className="kern-label">Suggest 3 random slots</span>
        </button>
        <button
          className="kern-btn kern-btn--primary"
          disabled={slotDrafts.length === 0}
          onClick={onSaveDrafts}
          type="button"
        >
          <span className="kern-label">Save time slots</span>
        </button>
      </div>

      {error && <InlineError message={error} />}
    </section>
  );
}

// Supporting: decision badge (not a kern component)
function DecisionBadge({ decision }: { readonly decision?: Decision | null }) {
  if (!decision) return <span className="text-slate-400 text-sm">—</span>;
  if (decision === "ACCEPT") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        Accept
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      Reject
    </span>
  );
}

export function SlotsTableSection({
  overview,
}: {
  readonly overview: OverviewDto;
}) {
  const { confirmSlot, deleteSlot, deleteAllSlots, isLoading, state } = useRichterActions();
  const statusesBySlotId = new Map(
    overview.statuses.map((status) => [status.slotId, status] as const),
  );
  const hasMultipleMutualsWithoutFinal =
    overview.statuses.filter((status) => status.isMutuallyAccepted).length >= 2 &&
    !overview.finalSlotId;

  return (
    // Supporting: card container, table flushes to edges
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Supporting: section header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="kern-heading-small">Time slots</h3>
      </div>

      {/* Supporting: mutual-slots warning banner */}
      {hasMultipleMutualsWithoutFinal && (
        <div className="px-6 pt-4">
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            Multiple slots were mutually accepted. Please confirm one as the final appointment.
          </div>
        </div>
      )}

      {overview.slots.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="kern-body">No time slots saved yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="kern-table" aria-labelledby="slots-table-title">
              <caption className="kern-title" id="slots-table-title">
                Time slots
              </caption>
              <thead className="kern-table__head">
                <tr className="kern-table__row">
                  <th scope="col" className="kern-table__header">
                    Time slot
                  </th>
                  <th scope="col" className="kern-table__header">
                    Kläger
                  </th>
                  <th scope="col" className="kern-table__header">
                    Beklagter
                  </th>
                  <th scope="col" className="kern-table__header">
                    Mutual
                  </th>
                  <th scope="col" className="kern-table__header kern-table__header--action">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="kern-table__body">
                {overview.slots.map((slot) => {
                  const status = statusesBySlotId.get(slot.id);
                  const isFinal = slot.id === overview.finalSlotId;
                  const rowId = `slot-${slot.id}`;

                  return (
                    <tr key={slot.id} className="kern-table__row">
                      <th scope="row" className="kern-table__header" id={rowId}>
                        {/* Supporting: final indicator badge */}
                        <div className="flex items-center gap-2">
                          {isFinal && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                              Final
                            </span>
                          )}
                          {formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
                        </div>
                      </th>
                      <td className="kern-table__cell">
                        {/* Supporting: decision badge */}
                        <DecisionBadge decision={status?.klaegerDecision ?? undefined} />
                      </td>
                      <td className="kern-table__cell">
                        <DecisionBadge decision={status?.beklagterDecision ?? undefined} />
                      </td>
                      <td className="kern-table__cell">
                        {/* Supporting: mutual badge */}
                        {status?.isMutuallyAccepted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">No</span>
                        )}
                      </td>
                      <td className="kern-table__cell kern-table__cell--action">
                        {status?.isMutuallyAccepted && !isFinal && (
                          <button
                            className="kern-btn kern-btn--tertiary kern-btn--x-small"
                            id={`btn-confirm-${slot.id}`}
                            aria-labelledby={`btn-confirm-${slot.id} ${rowId}`}
                            title="Make final"
                            onClick={() => confirmSlot(slot.id)}
                            disabled={isLoading}
                            type="button"
                          >
                            <span className="kern-icon kern-icon--check" aria-hidden="true" />
                            <span className="kern-label kern-sr-only">
                              {state === "submitting" ? "Making final…" : "Make final"}
                            </span>
                          </button>
                        )}
                        <button
                          className="kern-btn kern-btn--tertiary kern-btn--x-small"
                          id={`btn-delete-${slot.id}`}
                          aria-labelledby={`btn-delete-${slot.id} ${rowId}`}
                          title="Delete"
                          onClick={() => deleteSlot(slot.id)}
                          disabled={isLoading}
                          type="button"
                        >
                          <span className="kern-icon kern-icon--delete" aria-hidden="true" />
                          <span className="kern-label kern-sr-only">
                            {state === "submitting" ? "Deleting…" : "Delete"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Supporting: table footer */}
          <div className="px-6 py-4 border-t border-slate-100">
            <button
              className="kern-btn kern-btn--tertiary"
              onClick={() => deleteAllSlots()}
              disabled={isLoading}
              type="button"
            >
              <span className="kern-label">
                {state === "submitting" ? "Deleting…" : "Delete all slots"}
              </span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function PartyAccessSection({
  overview,
}: {
  readonly overview: OverviewDto;
}) {
  return (
    // Supporting: card container
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h3 className="kern-heading-small">Party submission access</h3>
      <div className="space-y-3">
        <PartyRow
          hasSubmitted={overview.hasSubmitted.KLAEGER}
          isOpen={overview.isSubmissionOpen.KLAEGER}
          label="Kläger"
          partyRole="KLAEGER"
        />
        <PartyRow
          hasSubmitted={overview.hasSubmitted.BEKLAGTER}
          isOpen={overview.isSubmissionOpen.BEKLAGTER}
          label="Beklagter"
          partyRole="BEKLAGTER"
        />
      </div>
    </section>
  );
}

function PartyRow({
  hasSubmitted,
  isOpen,
  label,
  partyRole,
}: {
  readonly hasSubmitted: boolean;
  readonly isOpen: boolean;
  readonly label: string;
  readonly partyRole: PartyRole;
}) {
  const { unlock, isLoading, state } = useRichterActions();

  return (
    // Supporting: row card
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-700 w-20">{label}</span>
        {/* Supporting: status pills */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            hasSubmitted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {hasSubmitted ? "Submitted" : "Pending"}
        </span>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isOpen ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
          }`}
        >
          {isOpen ? "Open" : "Locked"}
        </span>
      </div>
      <button
        className="kern-btn kern-btn--secondary"
        onClick={() => unlock(partyRole)}
        disabled={isOpen || isLoading}
        type="button"
      >
        {/* Supporting: lock icon as content inside the kern button */}
        <span
          className="material-symbols-outlined text-[16px] leading-none select-none"
          aria-hidden="true"
        >
          lock
        </span>
        <span className="kern-label">
          {state === "submitting" ? "Unlocking…" : "Unlock"}
        </span>
      </button>
    </div>
  );
}

export function appendRandomSlots(drafts: readonly SlotDraft[]): SlotDraft[] {
  return [...drafts, ...generateRandomSlotDrafts()];
}
