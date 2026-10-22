import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAppointments } from "~/adapters/appointments/appointments.server";

import Overview, { loader } from "../overview";

vi.mock("~/adapters/appointments/appointments.server", () => ({ listAppointments: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));
vi.mock("~/adapters/session/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "u1",
    name: "Muthig",
    email: "muthig@justiz.niedersachsen.de",
    roles: ["richter"],
  }),
}));

function renderPage() {
  const Stub = createRoutesStub([
    { path: "/overview", Component: Overview, loader },
    { path: "/overview/:appointmentId/confirm", Component: () => <h1>Bestätigung</h1> },
    { path: "/overview/new", Component: () => <h1>Neu</h1> },
  ]);
  return render(<Stub initialEntries={["/overview"]} />);
}

const slot = { start: new Date("2099-11-09T14:30:00Z"), end: new Date("2099-11-09T15:30:00Z") };

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the user's appointments with their status, in the given order", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "draft", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "open", confirmedSlot: null },
      { id: "c", aktenzeichen: "574 C 3/26", status: "confirmed", confirmedSlot: slot },
      { id: "d", aktenzeichen: "574 C 4/26", status: "cancelled", confirmedSlot: null },
    ]);

    renderPage();

    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "574 C 1/26Entwurf",
      "574 C 2/26Offen für Rückmeldungen",
      expect.stringMatching(/^574 C 3\/26Termin ist \p{L}+, 9\. November 2099 um 15:30$/u),
      "574 C 4/26Kein Zeitfenster passt",
    ]);
    expect(listAppointments).toHaveBeenCalledWith({ db: true }, "u1");
  });

  it("links only drafts, to their confirmation page", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "draft", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "open", confirmedSlot: null },
    ]);

    renderPage();

    const draftRow = (await screen.findByText("574 C 1/26")).closest("tr")!;
    expect(within(draftRow).getByRole("link", { name: "574 C 1/26" })).toHaveAttribute(
      "href",
      "/overview/a/confirm",
    );
    const openRow = screen.getByText("574 C 2/26").closest("tr")!;
    expect(within(openRow).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a message instead of an empty table when there are no appointments", async () => {
    vi.mocked(listAppointments).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Sie haben noch keine Terminumfragen erstellt.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terminumfrage erstellen" })).toBeVisible();
  });
});
