import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

    const thrown = await loader({ request: request(), params }).catch((error: Response) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("Location")).toBe("/overview/a1/confirm");
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

describe("OverviewDetail", () => {
  it("looks back at a past appointment and lists its time windows", async () => {
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      aktenzeichen: "574 C 65412/26",
      slots,
      confirmedSlot: {
        start: new Date("2020-08-03T11:30:00Z"),
        end: new Date("2020-08-03T12:30:00Z"),
      },
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Der Termin war am \p{L}+, dem 3\. August 2020 um 13:30\.$/u,
      }),
    ).toBeVisible();
    // A neutral banner with the back link below it, not a badge.
    expect(document.querySelector(".result-banner--default")).toBeInTheDocument();
    expect(document.querySelector(".kern-badge")).toBeNull();
    expect(screen.getByRole("link", { name: "Zur Übersicht" })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.queryByRole("link", { name: "Zurück zu den Terminumfragen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Problem mit dieser Seite melden" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.getByText("09:00 bis 11:00")).toBeVisible();
  });

  it("shows an open appointment with its actions and time windows", async () => {
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Die Terminumfrage ist aktiv und die Verfahrensbeteiligten können ihre Verfügbarkeiten teilen.",
      }),
    ).toBeVisible();
    // The open state is an info banner, not a badge, with the back link below it.
    expect(screen.queryByText("Offen für Rückmeldungen")).not.toBeInTheDocument();
    expect(document.querySelector(".kern-alert--info")).toContainElement(
      screen.getByRole("link", { name: "Termin auswählen" }),
    );
    expect(screen.getByRole("link", { name: "Zur Übersicht" })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.queryByRole("link", { name: "Zurück zu den Terminumfragen" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Bereiche" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Termin auswählen" })).toHaveAttribute(
      "href",
      "/overview/a1/select",
    );
    expect(screen.getByRole("button", { name: "Link zur Terminumfrage kopieren" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.getByText("09:00 bis 11:00")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Terminumfrage erstellen" })).not.toBeInTheDocument();
  });

  it("announces the date of a confirmed appointment", async () => {
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      aktenzeichen: "574 C 65412/26",
      slots,
      confirmedSlot: {
        start: new Date("2099-11-09T14:30:00Z"),
        end: new Date("2099-11-09T15:30:00Z"),
      },
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Der Termin ist am \p{L}+, 9\. November 2099 um 15:30\.$/u,
      }),
    ).toBeVisible();
    // The announcement is a success banner, not a badge, with the back link below it.
    expect(screen.queryByText(/^Termin ist \p{L}+, 9\. November 2099 um 15:30$/u)).toBeNull();
    expect(document.querySelector(".kern-alert--success")).toContainElement(
      screen.getByRole("heading", { level: 1 }),
    );
    expect(screen.getByRole("link", { name: "Zur Übersicht" })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.queryByRole("link", { name: "Zurück zu den Terminumfragen" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Bereiche" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByText("574 C 65412/26", { selector: "dd" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.getByText("09:00 bis 11:00")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Terminumfrage erstellen" })).not.toBeInTheDocument();
  });

  it("explains that no slot fits and offers a new Terminumfrage", async () => {
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
      { path: "/overview/new", Component: () => <h1>Neu</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Es gibt leider kein Zeitfenster, dass allen Verfahrensbeteiligten passt.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Starten Sie eine neue Terminumfrage.")).toBeVisible();
    expect(document.querySelector(".kern-alert--warning")).toBeInTheDocument();
    expect(screen.queryByText("Kein Zeitfenster passt")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Übersicht" })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.queryByRole("link", { name: "Zurück zu den Terminumfragen" })).toBeNull();
    const sidebar = screen.getByRole("navigation", { name: "Bereiche" });
    expect(within(sidebar).getByRole("link", { name: "Übersicht" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Terminumfrage erstellen" })).toHaveAttribute(
      "href",
      "/overview/new",
    );
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByText("Aktenzeichen")).toBeVisible();
    expect(screen.getAllByText("574 C 65412/26").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.getByText("17. September 2026")).toBeVisible();
    expect(screen.getByText("09:00 bis 11:00")).toBeVisible();
    expect(screen.getByText("14:00 bis 17:00")).toBeVisible();
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
    const response = (await invite("invite-email:p1")) as Response;

    expect(sendInvitationEmail).toHaveBeenCalledWith({
      to: "person.a@example.com",
      token: "tok-p1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "email");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/overview/a1");
  });

  it("does not record an e-mail that could not be sent and says so", async () => {
    vi.mocked(sendInvitationEmail).mockResolvedValue(false);

    const result = await invite("invite-email:p1");

    expect(result).toMatchObject({ data: { notSent: "Person A" }, init: { status: 502 } });
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("answers 400 for an e-mail invitation of a guest without an address", async () => {
    vi.mocked(findInvitee).mockResolvedValue({ ...invitee, email: null });

    await expect(invite("invite-email:p1")).rejects.toMatchObject({ init: { status: 400 } });
    expect(sendInvitationEmail).not.toHaveBeenCalled();
    expect(recordInvitation).not.toHaveBeenCalled();
  });

  it("hands an ERV invitation to the ERV and records it", async () => {
    const response = (await invite("invite-erv:p1")) as Response;

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
    const response = (await invite("invite-manual:p1")) as Response;

    expect(sendInvitationEmail).not.toHaveBeenCalled();
    expect(sendErvInvitation).not.toHaveBeenCalled();
    expect(recordInvitation).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1", "manual");
    expect(response.status).toBe(302);
  });

  it("answers 404 when the appointment closed before the invitation was recorded", async () => {
    vi.mocked(recordInvitation).mockResolvedValue(false);

    await expect(invite("invite-manual:p1")).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("offers each open guest the ways that reach them and shows how and when they were invited", async () => {
    vi.mocked(listGuests).mockResolvedValue(guests);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    const table = await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    const [, first, second] = within(table).getAllByRole("row");

    // Every invitation with its channel and time, newest first.
    const sent = within(first!).getAllByRole("listitem");
    expect(sent).toHaveLength(2);
    expect(sent[0]).toHaveTextContent(
      /^Manuell eingeladenam \p{L}+, 20\. November 2026 um 10:15$/u,
    );
    expect(sent[1]).toHaveTextContent(
      /^Per E-Mail eingeladenam \p{L}+, 19\. November 2026 um 08:00$/u,
    );
    const firstActions = within(first!).getByRole("group", { name: "Person A einladen" });
    expect(within(firstActions).getByRole("button", { name: "Per E-Mail" })).toHaveAttribute(
      "value",
      "invite-email:p1",
    );
    expect(within(firstActions).queryByRole("button", { name: "Per ERV" })).toBeNull();
    expect(
      within(firstActions).getByRole("button", { name: "Als eingeladen markieren" }),
    ).toBeVisible();

    expect(within(second!).getByText("Nicht eingeladen")).toBeVisible();
    expect(within(second!).getByText("SAFE-ID: DE.Example.1")).toBeVisible();
    const secondActions = within(second!).getByRole("group", { name: "DE.Example.1 einladen" });
    expect(within(secondActions).queryByRole("button", { name: "Per E-Mail" })).toBeNull();
    expect(within(secondActions).getByRole("button", { name: "Per ERV" })).toHaveAttribute(
      "value",
      "invite-erv:p2",
    );
  });

  it("shows the guests of a closed Terminumfrage without invite buttons", async () => {
    vi.mocked(listGuests).mockResolvedValue(guests);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(await screen.findByRole("table", { name: "Verfahrensbeteiligte" })).toBeVisible();
    expect(screen.getByText("Per E-Mail eingeladen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Manuell eingeladen" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Einladen" })).toBeNull();
  });

  it("says when there are no guests", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

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
