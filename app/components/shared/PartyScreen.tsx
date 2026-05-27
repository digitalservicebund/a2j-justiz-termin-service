import { Form, useActionData } from "react-router";
import type { AuthUser } from "~/core/domain/user";
import type { PartyRole } from "~/core/domain/verfahren";
import { formatSlotRange, InlineError, loadOverview, Shell } from "~/components/shared/SchedulingShared";

type Overview = Awaited<ReturnType<typeof loadOverview>>;

export function PartyScreen({
  role,
  overview,
  user,
}: {
  readonly role: PartyRole;
  readonly overview: Overview;
  readonly user: AuthUser;
}) {
  const actionData = useActionData<{ error: string } | null>();

  const existingDecisionMap: Record<string, string> = {};
  for (const status of overview.statuses) {
    const decision = role === "KLAEGER" ? status.klaegerDecision : status.beklagterDecision;
    if (decision) existingDecisionMap[status.slotId] = decision;
  }

  const isLocked = !overview.isSubmissionOpen[role];
  const roleLabel = role === "KLAEGER" ? "Kläger" : "Beklagter";

  // Key changes when decisions are saved so uncontrolled inputs remount with fresh defaultChecked
  const decisionKey = overview.statuses
    .map((s) => `${s.slotId}:${role === "KLAEGER" ? s.klaegerDecision : s.beklagterDecision}`)
    .join(",");

  return (
    <Shell title={`${roleLabel} – Response`} user={user}>
      {/* Supporting: case name card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Case</p>
        <h2 className="kern-heading-medium">{overview.name}</h2>
      </div>

      {/* Supporting: lock / open status banner */}
      {isLocked ? (
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-medium">
          <span className="material-symbols-outlined text-[20px] leading-none select-none" aria-hidden="true">
            lock
          </span>
          Submission is locked. Only the Richter can unlock it.
        </div>
      ) : (
        <div className="px-5 py-4 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-sm font-medium">
          Please accept or reject every time slot below, then submit.
        </div>
      )}

      {/* Supporting: form card wrapping pure kern components */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <Form key={decisionKey} method="post" className="space-y-4">
          {overview.slots.length === 0 ? (
            <p className="kern-body">No time slots available yet.</p>
          ) : (
            overview.slots.map((slot) => (
              <fieldset key={slot.id} className="kern-fieldset" disabled={isLocked}>
                <legend className="kern-label kern-label--large">
                  {formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
                </legend>
                <div className="kern-fieldset__body">
                  <div className="kern-form-check">
                    <input
                      type="radio"
                      className="kern-form-check__radio"
                      id={`${slot.id}-accept`}
                      name={slot.id}
                      value="ACCEPT"
                      defaultChecked={existingDecisionMap[slot.id] === "ACCEPT"}
                    />
                    <label className="kern-label" htmlFor={`${slot.id}-accept`}>
                      Accept
                    </label>
                  </div>
                  <div className="kern-form-check">
                    <input
                      type="radio"
                      className="kern-form-check__radio"
                      id={`${slot.id}-reject`}
                      name={slot.id}
                      value="REJECT"
                      defaultChecked={existingDecisionMap[slot.id] === "REJECT"}
                    />
                    <label className="kern-label" htmlFor={`${slot.id}-reject`}>
                      Reject
                    </label>
                  </div>
                </div>
              </fieldset>
            ))
          )}

          {actionData?.error && <InlineError message={actionData.error} />}

          <button
            className="kern-btn kern-btn--primary"
            disabled={isLocked || overview.slots.length === 0}
            type="submit"
          >
            <span className="kern-label">Submit decisions</span>
          </button>
        </Form>
      </div>
    </Shell>
  );
}
