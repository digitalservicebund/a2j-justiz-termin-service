import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import {
  findInvitee,
  listGuests,
  recordInvitation,
  type Guest,
  type Invitee,
} from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";
import { sendInvitationEmail } from "~/lib/email/send-invitation-email";
import { sendErvInvitation } from "~/lib/erv/send-erv-invitation";

import OverviewDetail, { action, loader } from "./detail";

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
const request = () => new Request("http://localhost:3000/overview/a1");

// 10:00 and 14:00 Berlin time in summer are 08:00 and 12:00 UTC.
const slots = [
  { id: "s1", start: new Date("2026-09-24T12:00:00Z"), end: new Date("2026-09-24T15:00:00Z") },
  { id: "s2", start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
  { id: "s3", start: new Date("2026-09-24T07:00:00Z"), end: new Date("2026-09-24T09:00:00Z") },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(judge);
  vi.mocked(listGuests).mockResolvedValue([]);
});

describe("overview detail route", () => {
  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: request(), params })).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
  });

  it("answers 404 for an open appointment without a survey token", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: null,
      aktenzeichen: "574 C 65412/26",
      slots,
    });

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("returns the windows and the survey link of an open appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });

    const result = await loader({ request: request(), params });

    expect(result).toMatchObject({
      state: "open",
      aktenzeichen: "574 C 65412/26",
      surveyUrl: "http://localhost:3000/verhandlungstermin-finder/umfrage/tok1",
    });
    expect("days" in result && result.days).toHaveLength(2);
  });

  it("marks a confirmed appointment as past once its slot is over and returns the windows", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      aktenzeichen: "574 C 65412/26",
      slots,
      // 13:30 Berlin time in August is 11:30 UTC; Monday 3 August 2020.
      confirmedSlot: {
        start: new Date("2020-08-03T11:30:00Z"),
        end: new Date("2020-08-03T12:30:00Z"),
      },
    });

    const result = await loader({ request: request(), params });

    expect(result).toMatchObject({
      state: "confirmed",
      past: true,
      badge: { type: "custom-grey" },
      termin: expect.stringMatching(/^\p{L}+, 3\. August 2020 um 13:30$/u),
    });
    expect("days" in result && result.days).toHaveLength(2);
  });

  it("answers 404 for a confirmed appointment without a confirmed slot", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      aktenzeichen: "A 1",
      slots,
      confirmedSlot: null,
    });

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("returns the date and the status badge of a confirmed appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      aktenzeichen: "574 C 65412/26",
      slots,
      // 15:30 Berlin time in November is 14:30 UTC; Monday 9 November 2099.
      confirmedSlot: {
        start: new Date("2099-11-09T14:30:00Z"),
        end: new Date("2099-11-09T15:30:00Z"),
      },
    });

    const result = await loader({ request: request(), params });

    expect(result).toMatchObject({
      state: "confirmed",
      past: false,
      aktenzeichen: "574 C 65412/26",
      badge: { type: "success" },
    });
    expect(result).toMatchObject({
      termin: expect.stringMatching(/^\p{L}+, 9\. November 2099 um 15:30$/u),
    });
  });

  it("sends a draft back to its review", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "draft",
      aktenzeichen: "A 1",
      slots: [],
    });

    const thrown = await callLoader(loader, { request: request(), params });

    expect(thrown).toMatchObject({ thrown: true, status: 302, location: "/overview/a1/confirm" });
  });

  it("returns the Aktenzeichen and the windows per day for a cancelled appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });

    const result = await loader({ request: request(), params });

    expect(result).toMatchObject({ state: "cancelled", aktenzeichen: "574 C 65412/26" });
    expect("days" in result && result.days).toEqual([
      { key: "2026-09-17", label: "17. September 2026", times: ["10:00 bis 14:00"] },
      {
        key: "2026-09-24",
        label: "24. September 2026",
        times: ["09:00 bis 11:00", "14:00 bis 17:00"],
      },
    ]);
  });
});

function renderDetail() {
  const Stub = createRoutesStub([
    { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
  ]);
  render(<Stub initialEntries={["/overview/a1"]} />);
}

// What the page shows per state. E2E (overview.spec.ts) covers the headings, the time windows, the
// back link and the survey link; these tests cover what each state adds on top.
describe("OverviewDetail", () => {
  const past = {
    id: "a1",
    status: "confirmed" as const,
    aktenzeichen: "574 C 65412/26",
    slots,
    confirmedSlot: {
      start: new Date("2020-08-03T11:30:00Z"),
      end: new Date("2020-08-03T12:30:00Z"),
    },
  };
  const confirmed = {
    ...past,
    confirmedSlot: {
      start: new Date("2099-11-09T14:30:00Z"),
      end: new Date("2099-11-09T15:30:00Z"),
    },
  };
  const open = {
    id: "a1",
    status: "open" as const,
    universalToken: "tok1",
    aktenzeichen: "574 C 65412/26",
    slots,
  };
  const cancelled = {
    id: "a1",
    status: "cancelled" as const,
    aktenzeichen: "574 C 65412/26",
    slots,
  };

  it.each([
    ["a past appointment", past, ".result-banner--default", false],
    ["a confirmed appointment", confirmed, ".kern-alert--success", false],
    ["an open appointment", open, ".kern-alert--info", false],
    ["a cancelled appointment", cancelled, ".kern-alert--warning", true],
  ])(
    "shows %s in its banner, and offers a new Terminumfrage only when no slot fits",
    async (_name, appointment, banner, offersNew) => {
      vi.mocked(getAppointment).mockResolvedValue(appointment);

      renderDetail();

      const heading = await screen.findByRole("heading", { level: 1 });
      expect(document.querySelector(banner)).toContainElement(heading);
      const create = screen.queryByRole("link", { name: "Terminumfrage erstellen" });
      if (offersNew) expect(create).toHaveAttribute("href", "/overview/new");
      else expect(create).toBeNull();
    },
  );

  it("offers an open appointment the choice of the Termin and, with JavaScript, copying the link", async () => {
    vi.mocked(getAppointment).mockResolvedValue(open);

    renderDetail();

    expect(await screen.findByRole("link", { name: "Termin auswählen" })).toHaveAttribute(
      "href",
      "/overview/a1/select",
    );
    expect(screen.getByRole("button", { name: "Link zur Terminumfrage kopieren" })).toBeVisible();
  });

  it("names a cancelled appointment by its Aktenzeichen, not by a status badge", async () => {
    vi.mocked(getAppointment).mockResolvedValue(cancelled);

    renderDetail();

    expect(await screen.findByText("574 C 65412/26", { selector: "dd" })).toBeVisible();
    expect(screen.queryByText("Kein Zeitfenster passt")).toBeNull();
  });
});

// 10:15 Berlin time in November is 09:15 UTC; Friday 20 November 2026. Newest first.
const guests: Guest[] = [
  {
    id: "p1",
    email: "person.a@example.com",
    safeId: null,
    name: "Person A",
    invitations: [
      { channel: "manual", at: new Date("2026-11-20T09:15:00Z") },
      { channel: "email", at: new Date("2026-11-19T07:00:00Z") },
    ],
  },
  { id: "p2", email: null, safeId: "DE.Example.1", name: null, invitations: [] },
];

const invitee: Invitee = {
  id: "p1",
  name: "Person A",
  email: "person.a@example.com",
  safeId: "DE.Example.1",
  token: "tok-p1",
  aktenzeichen: "574 C 65412/26",
  slots,
};

const invite = (intent: string) =>
  action({
    request: new Request("http://localhost:3000/overview/a1", {
      method: "POST",
      body: new URLSearchParams({ intent }),
    }),
    params,
  });

describe("guest invitations", () => {
  beforeEach(() => {
    vi.mocked(findInvitee).mockResolvedValue(invitee);
    vi.mocked(recordInvitation).mockResolvedValue(true);
    vi.mocked(sendInvitationEmail).mockResolvedValue(true);
    vi.mocked(sendErvInvitation).mockResolvedValue(true);
  });

  it("lists the guests with every invitation and its time, in every state", async () => {
    vi.mocked(listGuests).mockResolvedValue(guests);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });

    const result = await loader({ request: request(), params });

    expect(listGuests).toHaveBeenCalledWith({ db: true }, "1", "a1");
    expect(result.guests).toEqual([
      {
        id: "p1",
        email: "person.a@example.com",
        safeId: null,
        name: "Person A",
        invitations: [
          {
            label: "Manuell eingeladen",
            at: expect.stringMatching(/^\p{L}+, 20\. November 2026 um 10:15$/u),
          },
          {
            label: "Per E-Mail eingeladen",
            at: expect.stringMatching(/^\p{L}+, 19\. November 2026 um 08:00$/u),
          },
        ],
      },
      { id: "p2", email: null, safeId: "DE.Example.1", name: null, invitations: [] },
    ]);
  });

  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(invite("invite-manual:p1")).rejects.toBe(forbidden);
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("answers 400 for an unknown intent", async () => {
    await expect(invite("invite-fax:p1")).rejects.toMatchObject({ init: { status: 400 } });
    expect(findInvitee).not.toHaveBeenCalled();
  });

  it("answers 404 for a guest who cannot be invited", async () => {
    // Another user's guest, one of an appointment that is no longer open, or an unknown id.
    vi.mocked(findInvitee).mockResolvedValue(undefined);

    await expect(invite("invite-manual:p9")).rejects.toMatchObject({ init: { status: 404 } });
    expect(findInvitee).toHaveBeenCalledWith({ db: true }, "1", "a1", "p9");
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("mails the personal link, records the invitation and shows the page again", async () => {
    const response = await callAction(invite, "invite-email:p1");

    expect(sendInvitationEmail).toHaveBeenCalledWith({
      to: "person.a@example.com",
      token: "tok-p1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "email");
    expect(response).toMatchObject({
      thrown: false,
      status: 302,
      location: "/overview/a1#verfahrensbeteiligte",
    });
  });

  it("does not record an e-mail that could not be sent and says so", async () => {
    vi.mocked(sendInvitationEmail).mockResolvedValue(false);

    const result = await callAction(invite, "invite-email:p1");

    expect(result).toMatchObject({ thrown: false, status: 502, data: { notSent: "Person A" } });
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("answers 400 for an e-mail invitation of a guest without an address", async () => {
    vi.mocked(findInvitee).mockResolvedValue({ ...invitee, email: null });

    await expect(invite("invite-email:p1")).rejects.toMatchObject({ init: { status: 400 } });
    expect(sendInvitationEmail).not.toHaveBeenCalled();
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("hands an ERV invitation to the ERV and records it", async () => {
    const response = await callAction(invite, "invite-erv:p1");

    expect(sendErvInvitation).toHaveBeenCalledWith({
      appointmentId: "a1",
      participantId: "p1",
      safeId: "DE.Example.1",
    });
    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "erv");
    expect(response.status).toBe(302);
  });

  it("answers 400 for an ERV invitation of a guest without a SAFE-ID", async () => {
    vi.mocked(findInvitee).mockResolvedValue({ ...invitee, safeId: null });

    await expect(invite("invite-erv:p1")).rejects.toMatchObject({ init: { status: 400 } });
    expect(sendErvInvitation).not.toHaveBeenCalled();
  });

  it("records a manual invitation without sending anything", async () => {
    const response = await callAction(invite, "invite-manual:p1");

    expect(sendInvitationEmail).not.toHaveBeenCalled();
    expect(sendErvInvitation).not.toHaveBeenCalled();
    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "manual");
    expect(response.status).toBe(302);
  });

  it("answers 404 when the appointment closed before the invitation was recorded", async () => {
    vi.mocked(recordInvitation).mockResolvedValue(false);

    await expect(invite("invite-manual:p1")).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("says when there are no guests", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    renderDetail();

    expect(
      await screen.findByText("Sie haben keine Verfahrensbeteiligten angegeben."),
    ).toBeVisible();
    expect(screen.queryByRole("table", { name: "Verfahrensbeteiligte" })).toBeNull();
  });

  it("reports an e-mail that could not be sent", async () => {
    vi.mocked(listGuests).mockResolvedValue(guests);
    vi.mocked(sendInvitationEmail).mockResolvedValue(false);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader, action },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);
    const group = await screen.findByRole("group", { name: "Person A einladen" });
    fireEvent.click(within(group).getByRole("button", { name: "Per E-Mail" }));

    expect(
      await screen.findByText("Die Einladung an Person A konnte nicht gesendet werden."),
    ).toBeVisible();
    expect(recordInvitation).not.toHaveBeenCalled();
  });
});
