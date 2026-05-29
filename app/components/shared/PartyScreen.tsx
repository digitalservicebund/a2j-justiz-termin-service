import { Form, useActionData } from "react-router";
import Alert from "~/components/shared/Alert";
import { Button } from "~/components/shared/Button";
import { Card } from "~/components/shared/Card";
import InputRadios from "~/components/shared/InputRadios";
import {
  formatSlotRange,
  loadOverview,
  Shell,
} from "~/components/shared/SchedulingShared";
import type { AuthUser } from "~/core/domain/user";
import type { PartyRole } from "~/core/domain/verfahren";
import { Icon } from "~/components/shared/Icon";
import { TextLabel } from "~/components/shared/TextLabel";

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
      <Card>
        <p className="kern-body kern-body--muted">Case</p>
        <h2 className="kern-heading-medium">{overview.name}</h2>
      </Card>
      {hasSubmitted ? (
        <Alert
          type="success"
          title="Submitted"
          message="Submission is locked. Only the Richter can unlock it."
        />
      ) : (
        <Alert
          type="info"
          title="Please accept or reject every time slot below, then submit."
        />
      )}

      {actionData?.error && (
        <Alert type="error" title="Error" message={actionData.error} />
      )}

      <Form key={decisionKey} method="post" className="space-y-6">
        {overview.slots.length === 0 ? (
          <Alert type="warning" title="No time slots available yet" />
        ) : (
          overview.slots.map((slot) => (
            <Card key={slot.id}>
              <InputRadios
                legend={formatSlotRange(slot.startsAtIso, slot.endsAtIso)}
                name={slot.id}
                legendLarge
                disabled={hasSubmitted}
                defaultValue={existingDecisionMap[slot.id]}
                options={[
                  { value: "ACCEPT", label: "Accept" },
                  { value: "REJECT", label: "Reject" },
                ]}
              />
            </Card>
          ))
        )}

        <Button
          style="primary"
          disabled={hasSubmitted || overview.slots.length === 0}
          type="submit"
          aria-label="submit time slots"
        >
          <Icon name="check" />
          <TextLabel label="Submit" />
        </Button>
      </Form>
    </Shell>
  );
}
