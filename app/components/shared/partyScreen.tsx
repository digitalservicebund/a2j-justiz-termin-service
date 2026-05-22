import { Form, useActionData } from "react-router";
import type { AuthUser } from "@/domain/user";
import type { PartyRole } from "@/domain/verfahren";
import { formatSlotRange, InlineError, loadOverview, Shell } from "~/components/shared/schedulingShared";

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

  // Key changes when decisions are saved so uncontrolled inputs remount with fresh defaultChecked
  const decisionKey = overview.statuses
    .map((s) => `${s.slotId}:${role === "KLAEGER" ? s.klaegerDecision : s.beklagterDecision}`)
    .join(",");

  return (
    <Shell title={`${role === "KLAEGER" ? "Klaeger" : "Beklagter"} - Response`} user={user}>
      <section className="space-y-2 py-4">
        <h2 className="kern-heading-medium">{overview.name}</h2>
        <p className="kern-body">
          {isLocked
            ? "Submission is locked. Only Richter can unlock it again."
            : "Please accept or reject every time slot."}
        </p>
      </section>

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
          <span className="kern-label">Submit once</span>
        </button>
      </Form>
    </Shell>
  );
}
