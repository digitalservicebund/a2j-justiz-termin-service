// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ResponseOverview } from "~/adapters/appointments/survey.server";

import { logError } from "../../logging";
import { sendAnswerReceivedEmail } from "../send-answer-received-email";

const { sendMail, close } = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));

vi.mock("../../smtp", () => ({ createSmtpTransport: vi.fn(() => ({ sendMail, close })) }));
vi.mock("../../env", () => ({ requireEnv: () => "http://localhost:3000" }));
vi.mock("../../secrets", () => ({ requireSecret: () => "sender@example.com" }));
vi.mock("../../logging", () => ({ logError: vi.fn() }));

const overview: ResponseOverview = {
  appointmentId: "a 1",
  aktenzeichen: "574 C 65412/26",
  judgeEmail: " Judge.A@Example.com ",
  calendarSequence: 7,
  slots: [
    {
      id: "s1",
      start: new Date("2026-09-17T07:00:00Z"),
      end: new Date("2026-09-17T08:30:00Z"),
      responses: [{ participantId: "p1", name: "Guest A", available: true }],
    },
  ],
};

describe("sendAnswerReceivedEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({});
  });

  it("mails the judge of the appointment with the calendar and a link to the Termin", async () => {
    expect(await sendAnswerReceivedEmail(overview, { id: "p1", name: "Guest A" })).toBe(true);

    const message = sendMail.mock.calls[0]![0];
    expect(message).toMatchObject({ from: "sender@example.com", to: "judge.a@example.com" });
    expect(message.text).toContain("Guest A hat auf Ihre Terminumfrage geantwortet.");
    expect(message.text).toContain(
      "http://localhost:3000/verhandlungstermin-finder/overview/a%201",
    );
    expect(message.attachments.map(({ filename }: { filename: string }) => filename)).toContain(
      "terminumfrage.ics",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("logs a delivery failure instead of throwing", async () => {
    const failure = new Error("SMTP down");
    sendMail.mockRejectedValue(failure);

    expect(await sendAnswerReceivedEmail(overview, { id: "p1", name: "Guest A" })).toBe(false);
    expect(logError).toHaveBeenCalledWith("Failed to send answer-received email", failure);
    expect(close).toHaveBeenCalledOnce();
  });
});
