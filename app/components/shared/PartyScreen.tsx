import { Form, useActionData } from "react-router";
import Alert from "~/components/shared/Alert";
import { Card } from "~/components/shared/Card";
import {
  formatSlotRange,
  InlineError,
  loadOverview,
  Shell,
} from "~/components/shared/SchedulingShared";
import type { AuthUser } from "~/core/domain/user";
import type { PartyRole } from "~/core/domain/verfahren";

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
    const decision =
      role === "KLAEGER" ? status.klaegerDecision : status.beklagterDecision;
    if (decision) existingDecisionMap[status.slotId] = decision;
  }

  const hasSubmitted = overview.hasSubmitted[role];
  const roleLabel = role === "KLAEGER" ? "Kläger" : "Beklagter";

  // Key changes when decisions are saved so uncontrolled inputs remount with fresh defaultChecked
  const decisionKey = overview.statuses
    .map(
      (s) =>
        `${s.slotId}:${role === "KLAEGER" ? s.klaegerDecision : s.beklagterDecision}`,
    )
    .join(",");

  return (
    <Shell title={`${roleLabel} – Response`} user={user}>
      {/* Supporting: case name card */}
      <Card>
        <p className="mb-1 text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Case
        </p>
        <h2 className="kern-heading-medium">{overview.name}</h2>
      </Card>
      {hasSubmitted && (
        <Alert
          type="success"
          title="Submitted"
          message="Submission is locked. Only the Richter can unlock it."
        />
      )}

      {/* Supporting: form card wrapping pure kern components */}
      <Card>
        <Form key={decisionKey} method="post" className="space-y-4">
          <div className="space-y-4 p-0">
            <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-800">
              Please accept or reject every time slot below, then submit.
            </div>
            <hr className="kern-divider" aria-hidden="true" />
          </div>
          {overview.slots.length === 0 ? (
            <p className="kern-body">No time slots available yet.</p>
          ) : (
            overview.slots.map((slot) => (
              <fieldset
                key={slot.id}
                className="kern-fieldset"
                disabled={hasSubmitted}
              >
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
            disabled={hasSubmitted || overview.slots.length === 0}
            type="submit"
          >
            <span className="kern-label">Submit decisions</span>
          </button>
        </Form>
      </Card>
    </Shell>
  );
}
