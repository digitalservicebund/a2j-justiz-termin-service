// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import {
  findInvitee,
  listGuests,
  recordInvitation,
} from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "./created";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/adapters/appointments/invitations.server", () => ({
  listGuests: vi.fn(),
  findInvitee: vi.fn(),
  recordInvitation: vi.fn(),
}));
vi.mock("~/lib/email/send-invitation-email", () => ({ sendInvitationEmail: vi.fn() }));
vi.mock("~/lib/erv/send-erv-invitation", () => ({ sendErvInvitation: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const params = { appointmentId: "a1" };
const request = () => new Request("http://localhost:3000/overview/a1/created");

describe("create-termin created route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(listGuests).mockResolvedValue([]);
  });

  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: request(), params })).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("lists the proposed windows per day and the survey link of a published appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      // 10:00 and 14:00 Berlin time in summer are 08:00 and 12:00 UTC.
      slots: [
        {
          id: "s1",
          start: new Date("2026-09-24T12:00:00Z"),
          end: new Date("2026-09-24T13:00:00Z"),
        },
        {
          id: "s2",
          start: new Date("2026-09-17T08:00:00Z"),
          end: new Date("2026-09-17T09:00:00Z"),
        },
      ],
    });

    const result = await loader({ request: request(), params });

    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
    expect(result.days).toEqual([
      { key: "2026-09-17", label: "17. September 2026", times: ["10:00 bis 11:00"] },
      { key: "2026-09-24", label: "24. September 2026", times: ["14:00 bis 15:00"] },
    ]);
    expect(result.surveyUrl).toBe("http://localhost:3000/verhandlungstermin-finder/umfrage/tok1");
  });

  it("answers 404 for a published appointment without a survey token", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: null,
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("sends a draft back to its review", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "draft",
      aktenzeichen: "A 1",
      slots: [],
    });

    const thrown = await loader({ request: request(), params }).catch((error: Response) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("Location")).toBe("/overview/a1/confirm");
  });

  it("lists the guests with their invitations and lets an open survey invite them", async () => {
    vi.mocked(listGuests).mockResolvedValue([
      {
        id: "p1",
        email: "person.a@example.com",
        safeId: null,
        name: "Person A",
        // 10:15 Berlin time in November is 09:15 UTC.
        invitations: [{ channel: "erv", at: new Date("2026-11-20T09:15:00Z") }],
      },
    ]);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });

    const result = await loader({ request: request(), params });

    expect(listGuests).toHaveBeenCalledWith({ db: true }, "1", "a1");
    expect(result.canInvite).toBe(true);
    expect(result.guests).toEqual([
      {
        id: "p1",
        email: "person.a@example.com",
        safeId: null,
        name: "Person A",
        invitations: [
          {
            label: "Per ERV eingeladen",
            at: expect.stringMatching(/^\p{L}+, 20\. November 2026 um 10:15$/u),
          },
        ],
      },
    ]);
  });

  it("does not offer invitations once the survey is closed", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });

    expect((await loader({ request: request(), params })).canInvite).toBe(false);
  });

  it("records an invitation and comes back to the guest list of this page", async () => {
    vi.mocked(findInvitee).mockResolvedValue({
      id: "p1",
      name: "Person A",
      email: null,
      safeId: null,
      token: "tok-p1",
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });
    vi.mocked(recordInvitation).mockResolvedValue(true);

    const response = (await action({
      request: new Request("http://localhost:3000/overview/a1/created", {
        method: "POST",
        body: new URLSearchParams({ intent: "invite-manual:p1" }),
      }),
      params,
    })) as Response;

    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "manual");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/overview/a1/created#verfahrensbeteiligte");
  });

  it("answers 404 for a guest who cannot be invited", async () => {
    vi.mocked(findInvitee).mockResolvedValue(undefined);

    await expect(
      action({
        request: new Request("http://localhost:3000/overview/a1/created", {
          method: "POST",
          body: new URLSearchParams({ intent: "invite-manual:p9" }),
        }),
        params,
      }),
    ).rejects.toMatchObject({ init: { status: 404 } });
    expect(recordInvitation).not.toHaveBeenCalled();
  });
});
