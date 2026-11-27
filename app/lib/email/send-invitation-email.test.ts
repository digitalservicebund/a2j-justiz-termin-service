// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "../infra/logging.ts";
import { sendInvitationEmail } from "./send-invitation-email.ts";

const { sendMail, close } = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));

vi.mock("../infra/smtp.ts", () => ({ createSmtpTransport: vi.fn(() => ({ sendMail, close })) }));
vi.mock("../infra/env.ts", () => ({ requireEnv: () => "http://localhost:3000" }));
vi.mock("../infra/secrets.ts", () => ({ requireSecret: () => "sender@example.com" }));
vi.mock("../infra/logging.ts", async () => (await import("~tests/logging")).loggingMock());

const invitation = {
  to: " Guest.A@Example.com ",
  token: "tok/1",
  aktenzeichen: "574 C 65412/26",
  slots: [
    {
      id: "slot-1",
      start: new Date("2026-09-17T07:00:00Z"),
      end: new Date("2026-09-17T08:30:00Z"),
    },
  ],
};

describe("sendInvitationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({});
  });

  it("mails the guest their personal survey link", async () => {
    expect(await sendInvitationEmail(invitation)).toBe(true);

    expect(sendMail).toHaveBeenCalledOnce();
    const message = sendMail.mock.calls[0]![0];
    expect(message).toMatchObject({
      from: "sender@example.com",
      to: "guest.a@example.com",
      subject: "Einladung zur Terminumfrage",
    });
    expect(message.text).toContain(
      "http://localhost:3000/verhandlungstermin-finder/umfrage/tok%2F1",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports a delivery failure instead of throwing", async () => {
    const failure = new Error("SMTP down");
    sendMail.mockRejectedValue(failure);

    expect(await sendInvitationEmail(invitation)).toBe(false);
    expect(log.error).toHaveBeenCalledWith({ err: failure }, "Failed to send invitation email");
  });
});
