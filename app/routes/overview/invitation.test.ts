import { describe, expect, it } from "vitest";

import { inviteIntent, parseInviteIntent } from "./invitation";

describe("parseInviteIntent", () => {
  it("reads back the channel and the guest of every invite button", () => {
    for (const channel of ["email", "erv", "manual"] as const) {
      expect(parseInviteIntent(inviteIntent(channel, "p-1"))).toEqual({
        channel,
        participantId: "p-1",
      });
    }
  });

  it("rejects anything else", () => {
    for (const intent of [null, "", "invite-email:", "invite-fax:p-1", "delete-person:p-1"]) {
      expect(parseInviteIntent(intent)).toBeUndefined();
    }
    expect(parseInviteIntent(new File([], "f"))).toBeUndefined();
  });
});
