import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "~/adapters/session/session";
import {
  addSitzungstag,
  listSitzungstage,
  updateSitzungstag,
} from "~/adapters/users/sitzungstage.server";

import { messages } from "./schema";
import SitzungstagPage, { action, loader } from "./sitzungstag";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/users/sitzungstage.server", () => ({
  listSitzungstage: vi.fn(),
  addSitzungstag: vi.fn(),
  updateSitzungstag: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const renderPage = (id = "neu") => {
  const Stub = createRoutesStub([
    {
      path: "/einstellungen/sitzungstage/:sitzungstagId",
      Component: SitzungstagPage,
      loader,
      action,
    },
    { path: "/einstellungen", Component: () => <h1>Einstellungen</h1> },
  ]);
  render(<Stub initialEntries={[`/einstellungen/sitzungstage/${id}`]} />);
};

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

async function fillTimes(start: [string, string], end: [string, string]) {
  const [startHour, endHour] = screen.getAllByRole("textbox", { name: "Stunde" });
  const [startMinute, endMinute] = screen.getAllByRole("textbox", { name: "Minute" });
  for (const [input, value] of [
    [startHour, start[0]],
    [startMinute, start[1]],
    [endHour, end[0]],
    [endMinute, end[1]],
  ] as const) {
    await userEvent.clear(input!);
    if (value) await userEvent.type(input!, value);
  }
}

describe("SitzungstagPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({
      id: "j1",
      name: "Judge A",
      email: "judge.a@example.com",
      roles: ["richter"],
    });
    vi.mocked(listSitzungstage).mockResolvedValue([
      { id: "s1", weekday: 4, start: 8 * 60, end: 17 * 60 },
    ]);
    vi.mocked(addSitzungstag).mockResolvedValue({ id: "s2", weekday: 2, start: 0, end: 1 });
    vi.mocked(updateSitzungstag).mockResolvedValue(true);
  });

  it("asks for the weekday, Monday to Friday, and the regular times", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Wann ist Ihr Sitzungstag und wann sind Ihre reguläre Verhandlungszeiten?",
      }),
    ).toBeVisible();
    const day = screen.getByRole("group", { name: "Sitzungstag" });
    expect(
      within(day)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["1", "2", "3", "4", "5"]);
    for (const weekday of weekdays) {
      expect(within(day).getByRole("radio", { name: weekday })).not.toBeChecked();
    }
    const times = screen.getByRole("group", { name: "Reguläre Verhandlungszeiten" });
    expect(within(times).getByRole("group", { name: "Beginn" })).toBeVisible();
    expect(within(times).getByRole("group", { name: "Ende" })).toBeVisible();
    // The times are required, so the label does not say "Optional" as the design does.
    expect(screen.queryByText(/Optional/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abbrechen" })).toHaveAttribute(
      "href",
      "/einstellungen",
    );
  });

  it("fills in a saved Sitzungstag", async () => {
    renderPage("s1");

    expect(await screen.findByRole("radio", { name: "Donnerstag" })).toBeChecked();
    expect(
      screen
        .getAllByRole("textbox", { name: "Stunde" })
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["08", "17"]);
    expect(
      screen
        .getAllByRole("textbox", { name: "Minute" })
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(["00", "00"]);
  });

  it("saves a new Sitzungstag and goes back to the settings", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("radio", { name: "Dienstag" }));
    await fillTimes(["9", "30"], ["12", "00"]);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeVisible();
    expect(addSitzungstag).toHaveBeenCalledWith({ db: true }, "j1", {
      weekday: 2,
      start: 9 * 60 + 30,
      end: 12 * 60,
    });
  });

  it("shows what is missing next to the fields and keeps what was typed", async () => {
    renderPage();

    await screen.findByRole("radio", { name: "Montag" });
    await fillTimes(["9", ""], ["", ""]);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    const day = await screen.findByRole("group", { name: "Sitzungstag" });
    expect(day).toHaveAccessibleDescription(messages.weekday);
    const times = screen.getByRole("group", { name: "Reguläre Verhandlungszeiten" });
    expect(times).toHaveAccessibleDescription(`${messages.start} ${messages.end}`);
    expect(screen.getAllByRole("textbox", { name: "Stunde" })[0]).toHaveValue("9");
    expect(addSitzungstag).not.toHaveBeenCalled();
  });

  it("says which Sitzungstag a new one overlaps", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("radio", { name: "Donnerstag" }));
    await fillTimes(["16", "00"], ["18", "00"]);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(
        "Dieser Sitzungstag überschneidet sich mit Donnerstag, 08:00 bis 17:00.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: "Donnerstag" })).toBeChecked();
    expect(addSitzungstag).not.toHaveBeenCalled();
  });

  it("says when the end is not after the start", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("radio", { name: "Montag" }));
    await fillTimes(["12", "00"], ["09", "00"]);
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText(messages.range)).toBeVisible();
  });
});
