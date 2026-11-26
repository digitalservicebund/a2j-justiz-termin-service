import type { ErvSettlement } from "../../core/domain/invitation.ts";
import type { ErvVersandReply } from "../infra/erv-versand/erv-versand-client.ts";
import { isPayloadInvalid } from "../infra/erv-versand/erv-versand-messages.ts";
import { logError, logInfo } from "../infra/logging.ts";

// Records how the invitation with this correlation ID ended. False if there is no pending one.
type Settle = (correlationId: string, settlement: ErvSettlement) => Promise<boolean>;

// What a reply of the Basisdienst: ERV Versand means for the invitation. The problem type of a
// failure is kept, with the pointers of an invalid payload. Its details are not: they may contain
// personal data.
export function settlementOf({ outcome }: ErvVersandReply): ErvSettlement {
  if (outcome.kind === "sent") return { status: "sent" };
  if (outcome.kind === "unreadable") return { status: "failed", failure: outcome.reason };
  const { problem } = outcome;
  const pointers = isPayloadInvalid(problem)
    ? ` at ${problem.errors.map(({ pointer }) => pointer).join(", ")}`
    : "";
  return { status: "failed", failure: `${problem.type}${pointers}` };
}

// Handles every reply of the Basisdienst, at whichever instance it arrives: settles the pending
// invitation it belongs to. A reply that belongs to none, for example to an invitation settled
// before, is only logged. If settling fails, the reply is offered again.
export function ervReplyHandler(settle: Settle) {
  return async (reply: ErvVersandReply): Promise<void> => {
    const { correlationId, messageType } = reply;
    if (correlationId === undefined) {
      logError(`ERV reply ${messageType} without a correlation ID ignored`);
      return;
    }
    const settlement = settlementOf(reply);
    if (!(await settle(correlationId, settlement))) {
      logInfo(
        `ERV reply ${messageType} (correlation ID ${correlationId}) matches no pending invitation`,
      );
      return;
    }
    if (settlement.status === "sent") {
      logInfo(`ERV invitation sent (correlation ID ${correlationId})`);
    } else {
      logError(
        `ERV invitation not delivered (correlation ID ${correlationId}): ${settlement.failure}`,
      );
    }
  };
}
