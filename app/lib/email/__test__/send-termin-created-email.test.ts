// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "../../logging";
import { createSmtpTransport } from "../../smtp";
import { sendTerminCreatedEmail } from "../send-termin-created-email";

const { sendMail, close } = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));

vi.mock("../../smtp", () => ({ createSmtpTransport: vi.fn(() => ({ sendMail, close })) }));
vi.mock("../../env", () => ({ requireEnv: () => "http://localhost:3000" }));
vi.mock("../../secrets", () => ({ requireSecret: () => "sender@example.com" }));
vi.mock("../../logging", () => ({ logError: vi.fn() }));

const notification = {
  to: " Judge.A@Example.com ",
  appointmentId: "a 1",
  aktenzeichen: "574 C 65412/26",
  slots: [{ start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") }],
};

describe("sendTerminCreatedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({});
  });

  it("mails the judge with the calendar attached and a link to the Termin", async () => {
    expect(await sendTerminCreatedEmail(notification)).toBe(true);

    expect(sendMail).toHaveBeenCalledOnce();
    const message = sendMail.mock.calls[0]![0];
    expect(message).toMatchObject({ from: "sender@example.com", to: "judge.a@example.com" });
    expect(message.text).toContain("http://localhost:3000/overview/a%201");
    expect(message.attachments.map(({ filename }: { filename: string }) => filename)).toContain(
      "terminumfrage.ics",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("logs a delivery failure instead of throwing, and still closes the transport", async () => {
    const failure = new Error("SMTP down");
    sendMail.mockRejectedValue(failure);

    expect(await sendTerminCreatedEmail(notification)).toBe(false);
    expect(logError).toHaveBeenCalledWith(expect.any(String), failure);
    expect(close).toHaveBeenCalledOnce();
  });

  it("logs a missing mail configuration instead of throwing", async () => {
    const failure = new Error('Missing required environment variable "SMTP_HOST"');
    vi.mocked(createSmtpTransport).mockImplementationOnce(() => {
      throw failure;
    });

    expect(await sendTerminCreatedEmail(notification)).toBe(false);
    expect(logError).toHaveBeenCalledWith(expect.any(String), failure);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
