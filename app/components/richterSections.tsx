import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { OverviewDto } from "~/core/services/schedulingQuery";
import type { PartyRole } from "~/core/domain/verfahren";
import { formatSlotRange, InlineError } from "~/components/shared/schedulingShared";
import {
  decisionToLabel,
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
    <section className="space-y-2 py-4">
      <h2 className="kern-heading-medium">{caseName}</h2>
      <p className="kern-body">Final appointment: {finalSlotText}</p>
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
    <section className="space-y-4 py-4">
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

      {slotDrafts.length > 0 && (
        <ul className="space-y-3">
          {slotDrafts.map((slot, index) => (
            <li
              key={`${slot.startsAtLocal}-${slot.endsAtLocal}-${index}`}
              className="flex items-center justify-between gap-4 py-2"
            >
              <span className="kern-body">
                {new Date(slot.startsAtLocal).toLocaleString("de-DE")} -{" "}
                {new Date(slot.endsAtLocal).toLocaleString("de-DE")}
              </span>
              <button
                className="kern-btn kern-btn--tertiary"
                onClick={() => onRemoveDraft(index)}
                type="button"
              >
                <span className="kern-label">Remove</span>
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
    <section className="space-y-3 py-4">
      {overview.slots.length === 0 ? (
        <p className="kern-body">No time slots saved yet.</p>
      ) : (
        <>
          {hasMultipleMutualsWithoutFinal && (
            <p className="kern-body">
              Multiple slots were mutually accepted. Please confirm one as the final appointment.
            </p>
          )}
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
                  Klaeger
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
                  <tr key={slot.id} className={isFinal ? "kern-table__row bg-blue-50" : "kern-table__row"}>
                    <th scope="row" className="kern-table__header" id={rowId}>
                      {formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
                    </th>
                    <td className="kern-table__cell">
                      {decisionToLabel(status?.klaegerDecision)}
                    </td>
                    <td className="kern-table__cell">
                      {decisionToLabel(status?.beklagterDecision)}
                    </td>
                    <td className="kern-table__cell">
                      {status?.isMutuallyAccepted ? "Yes" : "No"}
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
                            {state === "submitting" ? "Making final..." : "Make final"}
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
                          {state === "submitting" ? "Deleting..." : "Delete"}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            className="kern-btn kern-btn--tertiary"
            onClick={() => deleteAllSlots()}
            disabled={isLoading}
            type="button"
          >
            <span className="kern-label">
              {state === "submitting" ? "Deleting..." : "Delete all slots"}
            </span>
          </button>
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
    <section className="space-y-3 py-4">
      <h3 className="kern-heading-small">Party submission access</h3>
      <PartyRow
        hasSubmitted={overview.hasSubmitted.KLAEGER}
        isOpen={overview.isSubmissionOpen.KLAEGER}
        label="Klaeger"
        partyRole="KLAEGER"
      />
      <PartyRow
        hasSubmitted={overview.hasSubmitted.BEKLAGTER}
        isOpen={overview.isSubmissionOpen.BEKLAGTER}
        label="Beklagter"
        partyRole="BEKLAGTER"
      />
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="kern-body">
        {label}: {hasSubmitted ? "submitted" : "not submitted"} /{" "}
        {isOpen ? "unlocked" : "locked"}
      </p>
      <button
        className="kern-btn kern-btn--secondary"
        onClick={() => unlock(partyRole)}
        disabled={isOpen || isLoading}
        type="button"
      >
        <span className="kern-label">
          {state === "submitting" ? "Unlocking..." : "Unlock"}
        </span>
      </button>
    </div>
  );
}

export function appendRandomSlots(drafts: readonly SlotDraft[]): SlotDraft[] {
  return [...drafts, ...generateRandomSlotDrafts()];
}
