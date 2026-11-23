// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { logInfo } from "../logging.ts";
import { sendErvInvitation } from "./send-erv-invitation.ts";

vi.mock("../logging.ts", () => ({ logInfo: vi.fn() }));

describe("sendErvInvitation", () => {
  it("only logs the invitation, by ids and without the SAFE-ID", async () => {
    expect(
      await sendErvInvitation({ appointmentId: "a1", participantId: "p1", safeId: "DE.Example.1" }),
    ).toBe(true);

    expect(logInfo).toHaveBeenCalledOnce();
    const [message] = vi.mocked(logInfo).mock.calls[0]!;
    expect(message).toContain("p1");
    expect(message).toContain("a1");
    expect(message).not.toContain("DE.Example.1");
  });
});
