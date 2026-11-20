import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { listGuests } from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";

import CreateTerminCreated, { loader } from "./created";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/adapters/appointments/invitations.server", () => ({
  listGuests: vi.fn(),
  findInvitee: vi.fn(),
  recordInvitation: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const renderPage = () => {
  const Stub = createRoutesStub([
    { path: "/overview/:appointmentId/created", Component: CreateTerminCreated, loader },
  ]);
  render(<Stub initialEntries={["/overview/a1/created"]} />);
};

describe("CreateTerminCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({
      id: "1",
      name: "Judge A",
      email: "judge.a@example.com",
      roles: ["richter"],
    });
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });
    vi.mocked(listGuests).mockResolvedValue([
      {
        id: "p1",
        email: "person.a@example.com",
        safeId: "DE.Example.1",
        name: "Person A",
        invitations: [],
      },
    ]);
  });

  it("asks the judge to invite the guests, with the shared link as a fallback", async () => {
    renderPage();

    const step = (
      await screen.findByRole("heading", {
        name: "Laden Sie die Verfahrensbeteiligten zur Terminumfrage ein.",
      })
    ).closest("li")!;
    expect(
      screen.queryByRole("heading", {
        name: "Teilen Sie den Link zur Terminumfrage mit allen Verfahrensbeteiligten.",
      }),
    ).toBeNull();

    // The guest list sits in the step, without a heading of its own.
    const list = within(step).getByRole("region", { name: "Verfahrensbeteiligte" });
    expect(within(list).queryByRole("heading")).toBeNull();
    const actions = within(list).getByRole("group", { name: "Person A einladen" });
    expect(within(actions).getByRole("button", { name: "Per E-Mail" })).toHaveAttribute(
      "value",
      "invite-email:p1",
    );
    expect(within(actions).getByRole("button", { name: "Per ERV" })).toBeVisible();
    expect(within(actions).getByRole("button", { name: "Als eingeladen markieren" })).toBeVisible();
    expect(within(list).getByText("Nicht eingeladen")).toBeVisible();

    // Sharing the link is the fallback, after the list.
    const link = within(step).getByRole("textbox", { name: "Link zur Terminumfrage" });
    expect(link).toHaveValue("http://localhost/verhandlungstermin-finder/umfrage/tok1");
    expect(list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the guests of a closed survey without invite buttons", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "confirmed",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });

    renderPage();

    expect(await screen.findByText("Nicht eingeladen")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Als eingeladen markieren" })).toBeNull();
  });
});
