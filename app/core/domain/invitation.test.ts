import { describe, expect, it } from "vitest";

import { ERV_REPLY_TIMEOUT_MS, invitationState } from "./invitation.ts";

const at = new Date("2026-11-25T10:00:00Z");
const after = (ms: number) => new Date(at.getTime() + ms);

describe("invitationState", () => {
  it("keeps a sent or failed invitation as it is", () => {
    expect(invitationState({ status: "sent", at }, after(ERV_REPLY_TIMEOUT_MS * 10))).toBe("sent");
    expect(invitationState({ status: "failed", at }, at)).toBe("failed");
  });

  it("is pending while the ERV may still reply", () => {
    expect(invitationState({ status: "pending", at }, at)).toBe("pending");
    expect(invitationState({ status: "pending", at }, after(ERV_REPLY_TIMEOUT_MS))).toBe("pending");
  });

  it("counts as not delivered once the ERV took too long to reply", () => {
    expect(invitationState({ status: "pending", at }, after(ERV_REPLY_TIMEOUT_MS + 1))).toBe(
      "failed",
    );
  });
});
