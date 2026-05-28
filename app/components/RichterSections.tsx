import type { ComponentProps, Dispatch, SetStateAction } from "react";
import {
  generateRandomSlotDrafts,
  type SlotDraft,
} from "~/components/richterHelpers";
import { Badge } from "~/components/shared/Badge";
import { Button } from "~/components/shared/Button";
import { Card } from "~/components/shared/Card";
import {
  formatSlotRange,
  InlineError,
} from "~/components/shared/SchedulingShared";
import type { Decision, PartyRole } from "~/core/domain/verfahren";
import type { OverviewDto } from "~/core/services/schedulingQuery";
import { useRichterActions } from "~/hooks/useRichterActions";

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
    <Card className="space-y-kern-space-large">
      <h3 className="kern-heading-small">Prepare new time slots</h3>
      <form
        className="space-y-kern-space-small space-x-kern-space-small"
        onSubmit={onAddDraft}
      >
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
              setDraft((current) => ({
                ...current,
                startsAtLocal: event.target.value,
              }))
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
              setDraft((current) => ({
                ...current,
                endsAtLocal: event.target.value,
              }))
            }
          />
        </div>
        <Button
          type="submit"
          style="secondary"
          iconLeft={
            <span
              className="kern-icon kern-icon--add kern-icon--default"
              aria-hidden="true"
            ></span>
          }
        />
      </form>
      {slotDrafts.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-slate-50">
          {slotDrafts.map((slot, index) => (
            <li
              key={`${slot.startsAtLocal}-${slot.endsAtLocal}-${index}`}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm text-slate-700">
                {new Date(slot.startsAtLocal).toLocaleString("de-DE")} –{" "}
                {new Date(slot.endsAtLocal).toLocaleString("de-DE")}
              </span>
              <Button
                onClick={() => onRemoveDraft(index)}
                type="button"
                style="tertiary"
                iconLeft={
                  <span
                    className="kern-icon kern-icon--delete"
                    aria-hidden="true"
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}

      <div className="gap-kern-space-small flex flex-wrap">
        <Button
          style="secondary"
          onClick={onSuggestRandom}
          type="button"
          label="Random slots"
          iconLeft={
            <span
              className="kern-icon kern-icon--autorenew kern-icon--default"
              aria-hidden="true"
            ></span>
          }
        />
        <Button
          style="primary"
          disabled={slotDrafts.length === 0}
          onClick={onSaveDrafts}
          type="button"
          label="Save time slots"
          iconLeft={
            <span
              className="kern-icon kern-icon--check kern-icon--default"
              aria-hidden="true"
            ></span>
          }
        />
      </div>

      {error && <InlineError message={error} />}
    </Card>
  );
}

function DecisionBadge({ decision }: { readonly decision?: Decision | null }) {
  if (!decision) return <span className="text-sm text-slate-400">—</span>;
  if (decision === "ACCEPT") {
    return <Badge type="success" label="Accepted" />;
  }
  return <Badge type="danger" label="Rejected" />;
}

export function SlotsTableSection({
  overview,
}: {
  readonly overview: OverviewDto;
}) {
  const { confirmSlot, deleteSlot, deleteAllSlots, isLoading, state } =
    useRichterActions();
  const statusesBySlotId = new Map(
    overview.statuses.map((status) => [status.slotId, status] as const),
  );
  const hasMultipleMutualsWithoutFinal =
    overview.statuses.filter((status) => status.isMutuallyAccepted).length >=
      2 && !overview.finalSlotId;

  return (
    <Card className="space-y-kern-space-large">
      {/* Supporting: mutual-slots warning banner */}
      {hasMultipleMutualsWithoutFinal && (
        <div className="px-6 pt-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Multiple slots were mutually accepted. Please confirm one as the
            final appointment.
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
                  <th
                    scope="col"
                    className="kern-table__header kern-table__header--action"
                  >
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
                        <div className="gap-kern-space-small flex items-center">
                          {isFinal && <Badge type="info" label="Final" />}
                          {formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
                        </div>
                      </th>
                      <td className="kern-table__cell">
                        {/* Supporting: decision badge */}
                        <DecisionBadge
                          decision={status?.klaegerDecision ?? undefined}
                        />
                      </td>
                      <td className="kern-table__cell">
                        <DecisionBadge
                          decision={status?.beklagterDecision ?? undefined}
                        />
                      </td>
                      <td className="kern-table__cell">
                        {/* Supporting: mutual badge */}
                        {status?.isMutuallyAccepted ? (
                          <Badge type="info" label="Yes" />
                        ) : (
                          <span className="text-sm text-slate-400">No</span>
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
                            <span
                              className="kern-icon kern-icon--check"
                              aria-hidden="true"
                            />
                            <span className="kern-label kern-sr-only">
                              {state === "submitting"
                                ? "Making final…"
                                : "Make final"}
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
                          <span
                            className="kern-icon kern-icon--delete"
                            aria-hidden="true"
                          />
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
          <div className="px-6 py-4">
            <Button
              style="secondary"
              onClick={() => deleteAllSlots()}
              disabled={isLoading}
              type="button"
              label={state === "submitting" ? "Deleting…" : "Delete all slots"}
              iconLeft={
                <span
                  className="kern-icon kern-icon--delete kern-icon--default"
                  aria-hidden="true"
                ></span>
              }
            />
          </div>
        </>
      )}
    </Card>
  );
}

export function PartyAccessSection({
  overview,
}: {
  readonly overview: OverviewDto;
}) {
  return (
    <Card className="space-y-kern-space-small">
      <h3 className="kern-heading-small">Party submission access</h3>
      <div className="space-y-kern-space-small">
        <PartyRow
          hasSubmitted={overview.hasSubmitted.KLAEGER}
          label="Kläger:"
          partyRole="KLAEGER"
        />
        <PartyRow
          hasSubmitted={overview.hasSubmitted.BEKLAGTER}
          label="Beklagter:"
          partyRole="BEKLAGTER"
        />
      </div>
    </Card>
  );
}

function PartyRow({
  hasSubmitted,
  label,
  partyRole,
}: {
  readonly hasSubmitted: boolean;
  readonly label: string;
  readonly partyRole: PartyRole;
}) {
  const { unlock, isLoading } = useRichterActions();

  return (
    <Card className="space-y-kern-space-small flex items-center justify-between">
      <div className="gap-kern-space-small flex items-center">
        <span className="kern-title kern-title--small">{label}</span>
        <Badge
          type={hasSubmitted ? "success" : "warning"}
          label={hasSubmitted ? "Submitted" : "Pending"}
        />
      </div>
      <Button
        onClick={() => unlock(partyRole)}
        disabled={!hasSubmitted || isLoading}
        type="button"
        title={hasSubmitted ? "Unlock submission" : "Submission open"}
        aria-label={hasSubmitted ? "Unlock submission" : "Submission open"}
        style="tertiary"
        iconLeft={
          <span
            className="material-symbols-outlined text-[18px] leading-none select-none"
            aria-hidden="true"
          >
            {hasSubmitted ? "lock" : "lock_open"}
          </span>
        }
      />
    </Card>
  );
}

export function appendRandomSlots(drafts: readonly SlotDraft[]): SlotDraft[] {
  return [...drafts, ...generateRandomSlotDrafts()];
}
