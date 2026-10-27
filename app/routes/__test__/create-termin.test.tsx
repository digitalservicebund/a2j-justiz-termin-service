import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDraftAppointment,
  publishAppointment,
  updateDraftAppointment,
} from "~/adapters/appointments/appointments.server";

import CreateTermin, { action, loader } from "../create-termin";
import CreateTerminConfirm, {
  action as confirmAction,
  loader as confirmLoader,
} from "../create-termin.confirm";
import { formatDate, nextWorkingDay } from "../create-termin.entry";
import { MAX_SLOTS } from "../create-termin.schema";

const appointments = vi.hoisted(() => new Map<string, Record<string, unknown>>());

// A fake of the database adapter: drafts live in a map, so the pages can be exercised end to end.
vi.mock("~/adapters/appointments/appointments.server", () => ({
  createDraftAppointment: vi.fn(async (_db, _userId, draft) => {
    appointments.set("abc", { id: "abc", status: "draft", ...draft });
    return "abc";
  }),
  updateDraftAppointment: vi.fn(async (_db, _userId, id, draft) => {
    appointments.set(id, { id, status: "draft", ...draft });
    return true;
  }),
  getAppointment: vi.fn(async (_db, _userId, id) => appointments.get(id)),
  publishAppointment: vi.fn(async () => true),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({}) }));

vi.mock("~/adapters/session/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    id: "1",
    name: "Judge A",
    email: "judge.a@example.com",
    roles: ["richter"],
  }),
}));

beforeEach(() => {
  appointments.clear();
  vi.clearAllMocks();
});

function renderPage() {
  const Stub = createRoutesStub([
    { path: "/overview/new", Component: CreateTermin, action, loader },
    {
      path: "/overview/:appointmentId/confirm",
      Component: CreateTerminConfirm,
      action: confirmAction,
      loader: confirmLoader,
    },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
    {
      path: "/overview/:appointmentId/created",
      Component: () => <h1>Sie haben die Terminumfrage erstellt.</h1>,
    },
  ]);
  return render(<Stub initialEntries={["/overview/new"]} />);
}

const TOO_FEW = "Geben Sie mindestens zwei Zeitfenster an.";

const rows = () => screen.queryAllByRole("group", { name: /^Zeitfenster \d+$/ });
const aktenzeichenInput = () => screen.getByRole("textbox", { name: "Aktenzeichen" });
const removeButtons = () =>
  screen.queryAllByRole("button", { name: /^Zeitfenster \d+ entfernen$/ });
const addArea = () => within(screen.getByRole("region", { name: "Zeitfenster hinzufügen" }));
const addDate = () => addArea().getByRole("textbox", { name: "Datum" });
const addStart = () => addArea().getByRole("textbox", { name: "Beginn" });
const addEnd = () => addArea().getByRole("textbox", { name: "Ende" });
const addButton = () => addArea().getByRole("button", { name: "Zeitfenster hinzufügen" });

// Far in the future so the "no past dates" rule never trips these tests.
const JAN_5 = "5.1.2099";
const JAN_6 = "6.1.2099";

// Adds one window per date through the add area, the way a user does.
function addWindows(dates: string, start = "9", end = "10") {
  fireEvent.change(addDate(), { target: { value: dates } });
  fireEvent.change(addStart(), { target: { value: start } });
  fireEvent.change(addEnd(), { target: { value: end } });
  fireEvent.click(addButton());
}

const field = (row: HTMLElement, name: "Datum" | "Beginn" | "Ende") =>
  within(row).getByRole("textbox", { name });
const valuesOf = (row: HTMLElement) =>
  [field(row, "Datum"), field(row, "Beginn"), field(row, "Ende")].map(
    (input) => (input as HTMLInputElement).value,
  );

const openCalendar = () =>
  userEvent.click(addArea().getByRole("button", { name: "Kalender öffnen" }));
const day = (name: RegExp) => screen.getByRole("button", { name });

function fillValidForm() {
  fireEvent.change(aktenzeichenInput(), { target: { value: "574 C 65412/26" } });
  addWindows(`${JAN_5}, ${JAN_6}`);
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

async function renderForm() {
  renderPage();
  await screen.findByRole("heading", { name: "Verhandlungsdaten" });
}

describe("CreateTermin adding time windows", () => {
  it("starts with an empty list and the limits as a hint", async () => {
    await renderForm();

    expect(rows()).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Ihre Zeitfenster (0)" })).toBeInTheDocument();
    expect(screen.getByText("Noch keine Zeitfenster hinzugefügt.")).toBeInTheDocument();
    expect(screen.getByText("Mindestens 2, höchstens 20 Zeitfenster.")).toBeInTheDocument();
  });

  it("adds one window per date from a single time range, newest last", async () => {
    await renderForm();

    addWindows(`${JAN_6}, ${JAN_5}`, "9:30", "11");

    const added = rows();
    expect(added).toHaveLength(2);
    expect(valuesOf(added[0]!)).toEqual(["05.01.2099", "09:30", "11:00"]);
    expect(valuesOf(added[1]!)).toEqual(["06.01.2099", "09:30", "11:00"]);
    expect(screen.getByRole("heading", { name: "Ihre Zeitfenster (2)" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 Zeitfenster hinzugefügt");
  });

  it("shows the weekday of each window", async () => {
    await renderForm();

    // 5 January 2099 is a Monday.
    addWindows(JAN_5);

    expect(within(rows()[0]!).getByText("Mo")).toBeInTheDocument();
  });

  it("turns typed dates into chips with comma and Enter, and adds on a second Enter", async () => {
    await renderForm();
    await userEvent.type(addStart(), "9");
    await userEvent.type(addEnd(), "10");

    await userEvent.type(addDate(), "5.1.2099,");
    await userEvent.type(addDate(), "6.1.2099{Enter}");

    expect(screen.getByRole("button", { name: "05.01.2099 entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "06.01.2099 entfernen" })).toBeInTheDocument();
    expect(addDate()).toHaveValue("");
    expect(rows()).toHaveLength(0);

    await userEvent.type(addDate(), "{Enter}");

    expect(rows()).toHaveLength(2);
    // Enter in the add area never submits the form.
    expect(createDraftAppointment).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "05.01.2099 entfernen" })).not.toBeInTheDocument();
  });

  it("removes a chip again", async () => {
    await renderForm();
    await userEvent.type(addDate(), "5.1.2099,6.1.2099,");

    await userEvent.click(screen.getByRole("button", { name: "05.01.2099 entfernen" }));

    expect(screen.queryByRole("button", { name: "05.01.2099 entfernen" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "06.01.2099 entfernen" })).toBeInTheDocument();
  });

  it("offers the next working day and the same times for the next round", async () => {
    await renderForm();

    addWindows(JAN_5, "9", "10");

    expect(addDate()).toHaveValue(formatDate(nextWorkingDay("2099-01-05")));
    expect(addDate()).toHaveFocus();
    expect(addStart()).toHaveValue("09:00");
    expect(addEnd()).toHaveValue("10:00");
  });

  it("reads a range typed into the start field when it loses focus", async () => {
    await renderForm();

    await userEvent.type(addStart(), "9-11");
    await userEvent.tab();

    expect(addStart()).toHaveValue("09:00");
    expect(addEnd()).toHaveValue("11:00");
  });

  it("moves on to the end time once the start time is complete", async () => {
    await renderForm();

    await userEvent.type(addStart(), "0930");

    expect(addEnd()).toHaveFocus();
    // Leaving the start field tidied it, with the last digit still in.
    expect(addStart()).toHaveValue("09:30");
  });

  it("calculates the end from a length", async () => {
    await renderForm();

    addWindows(JAN_5, "9", "+2h");

    expect(valuesOf(rows()[0]!)).toEqual(["05.01.2099", "09:00", "11:00"]);
  });

  it("understands short dates and words", async () => {
    await renderForm();

    addWindows("morgen, 1.1.2100");

    expect(rows()).toHaveLength(2);
    expect(valuesOf(rows()[1]!)[0]).toBe("01.01.2100");
  });

  describe("when something cannot be added", () => {
    it("asks for a date", async () => {
      await renderForm();

      addWindows("");

      expect(addArea().getByText("Geben Sie mindestens ein Datum an.")).toBeInTheDocument();
      expect(addDate()).toHaveFocus();
      expect(rows()).toHaveLength(0);
    });

    it("keeps unreadable dates in the field, adds the readable ones as chips and says so", async () => {
      await renderForm();

      addWindows("5.1.2099, nonsense");

      expect(addArea().getByText("Geben Sie ein gültiges Datum an.")).toBeInTheDocument();
      expect(addDate()).toHaveValue("nonsense");
      expect(screen.getByRole("button", { name: "05.01.2099 entfernen" })).toBeInTheDocument();
      expect(rows()).toHaveLength(0);
    });

    it.each([
      ["a missing start", "", "10", "Geben Sie eine gültige Startzeit an.", "add-start"],
      ["an unreadable end", "9", "late", "Geben Sie eine gültige Endzeit an.", "add-end"],
      [
        "an end before the start",
        "10",
        "9",
        "Die Endzeit muss nach der Startzeit liegen.",
        "add-end",
      ],
      ["a length past midnight", "23", "+2h", "Geben Sie eine gültige Endzeit an.", "add-end"],
    ])("rejects %s", async (_name, start, end, message, focused) => {
      await renderForm();

      addWindows(JAN_5, start, end);

      expect(addArea().getByText(message)).toBeInTheDocument();
      expect(document.getElementById(focused)).toHaveFocus();
      expect(rows()).toHaveLength(0);
    });

    it("clears an add error when the field is edited", async () => {
      await renderForm();
      addWindows(JAN_5, "", "10");
      expect(addArea().getByText("Geben Sie eine gültige Startzeit an.")).toBeInTheDocument();

      await userEvent.type(addStart(), "9");

      expect(addArea().queryByText("Geben Sie eine gültige Startzeit an.")).not.toBeInTheDocument();
    });

    it("skips a window that already exists and says so", async () => {
      await renderForm();
      addWindows(JAN_5);

      addWindows(`${JAN_5}, ${JAN_6}`);

      expect(rows()).toHaveLength(2);
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 Zeitfenster hinzugefügt, 1 übersprungen (bereits vorhanden)",
      );
    });

    it("skips a date in the past and says so", async () => {
      await renderForm();

      addWindows(`1.1.2020, ${JAN_5}`);

      expect(rows()).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 Zeitfenster hinzugefügt, 1 übersprungen (Datum in der Vergangenheit)",
      );
    });

    it("adds nothing if every date is skipped", async () => {
      await renderForm();

      addWindows("1.1.2020");

      expect(rows()).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Kein Zeitfenster hinzugefügt, 1 übersprungen (Datum in der Vergangenheit)",
      );
      expect(addDate()).toHaveValue("");
    });
  });

  describe("with the calendar", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2099-01-15T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("is closed until it is opened, and closes again", async () => {
      await renderForm();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();

      await openCalendar();
      expect(screen.getByRole("table", { name: "Januar 2099" })).toBeInTheDocument();
      expect(addArea().getByRole("button", { name: "Kalender schließen" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      await userEvent.click(addArea().getByRole("button", { name: "Kalender schließen" }));
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("does not offer days before today", async () => {
      await renderForm();

      await openCalendar();

      expect(day(/, 14\. Januar 2099/)).toBeDisabled();
      expect(day(/, 15\. Januar 2099/)).toBeEnabled();
      expect(day(/, 15\. Januar 2099/)).toHaveAttribute("aria-current", "date");
      expect(addArea().getByRole("button", { name: "Vorheriger Monat" })).toBeDisabled();
    });

    it("picks and unpicks days, which become chips, across months", async () => {
      await renderForm();
      await openCalendar();

      await userEvent.click(day(/, 20\. Januar 2099/));
      await userEvent.click(addArea().getByRole("button", { name: "Nächster Monat" }));
      expect(screen.getByRole("table", { name: "Februar 2099" })).toBeInTheDocument();
      await userEvent.click(day(/, 3\. Februar 2099/));

      expect(screen.getByRole("button", { name: "20.01.2099 entfernen" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "03.02.2099 entfernen" })).toBeInTheDocument();
      expect(day(/, 3\. Februar 2099/)).toHaveAttribute("aria-pressed", "true");

      await userEvent.click(day(/, 3\. Februar 2099/));
      expect(day(/, 3\. Februar 2099/)).toHaveAttribute("aria-pressed", "false");
      expect(
        screen.queryByRole("button", { name: "03.02.2099 entfernen" }),
      ).not.toBeInTheDocument();

      await userEvent.click(addArea().getByRole("button", { name: "Vorheriger Monat" }));
      expect(screen.getByRole("table", { name: "Januar 2099" })).toBeInTheDocument();
    });

    it("adds windows for the picked days", async () => {
      await renderForm();
      await openCalendar();
      await userEvent.click(day(/, 20\. Januar 2099/));
      await userEvent.click(day(/, 21\. Januar 2099/));

      fireEvent.change(addStart(), { target: { value: "13" } });
      fireEvent.change(addEnd(), { target: { value: "14:30" } });
      fireEvent.click(addButton());

      expect(rows().map(valuesOf)).toEqual([
        ["20.01.2099", "13:00", "14:30"],
        ["21.01.2099", "13:00", "14:30"],
      ]);
    });
  });
});

// Without layout the grid measures rows of 14px from the top, starting at 07:00.
const y = (hour: number, minute = 0) => ((hour * 60 + minute - 7 * 60) / 15) * 14 + 1;
const column = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
const openWeek = () =>
  userEvent.click(addArea().getByRole("button", { name: "Wochenansicht öffnen" }));

const drag = (iso: string, from: number, to: number) => {
  fireEvent.mouseDown(column(iso), { button: 0, clientY: from });
  fireEvent.mouseMove(window, { clientY: to });
  fireEvent.mouseUp(window, { clientY: to });
};

describe("CreateTermin week view", () => {
  // A Thursday, so Monday to Wednesday of its week are past.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-01-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("opens on the current week and closes again", async () => {
    await renderForm();
    expect(document.getElementById("add-week")).toBeNull();

    await openWeek();

    expect(screen.getByText("12.01.2099 – 16.01.2099")).toBeInTheDocument();
    expect(addArea().getByRole("button", { name: "Wochenansicht schließen" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await userEvent.click(addArea().getByRole("button", { name: "Wochenansicht schließen" }));
    expect(document.getElementById("add-week")).toBeNull();
  });

  it("moves between weeks, but not into the past, and can show the weekend", async () => {
    await renderForm();
    await openWeek();
    expect(addArea().getByRole("button", { name: "Vorherige Woche" })).toBeDisabled();
    expect(document.querySelectorAll("[data-date]")).toHaveLength(5);

    await userEvent.click(addArea().getByRole("button", { name: "Nächste Woche" }));
    expect(screen.getByText("19.01.2099 – 23.01.2099")).toBeInTheDocument();
    expect(addArea().getByRole("button", { name: "Vorherige Woche" })).toBeEnabled();

    await userEvent.click(screen.getByRole("checkbox", { name: "Wochenende anzeigen" }));
    expect(document.querySelectorAll("[data-date]")).toHaveLength(7);
    expect(screen.getByText("19.01.2099 – 25.01.2099")).toBeInTheDocument();
  });

  it("makes a window from a drag, snapped to quarter hours, and says so", async () => {
    await renderForm();
    await openWeek();

    drag("2099-01-16", y(9), y(10, 30));

    expect(rows().map(valuesOf)).toEqual([["16.01.2099", "09:00", "10:45"]]);
    expect(screen.getByRole("status")).toHaveTextContent("1 Zeitfenster hinzugefügt");
    expect(
      screen.getByRole("button", { name: "Zeitfenster Fr 16.01.2099, 09:00–10:45" }),
    ).toBeInTheDocument();
  });

  it("makes a window from a drag upwards", async () => {
    await renderForm();
    await openWeek();

    drag("2099-01-16", y(11), y(9));

    expect(rows().map(valuesOf)).toEqual([["16.01.2099", "09:00", "11:15"]]);
  });

  it("shows the window while it is dragged and drops it on Escape", async () => {
    await renderForm();
    await openWeek();

    fireEvent.mouseDown(column("2099-01-16"), { button: 0, clientY: y(9) });
    fireEvent.mouseMove(window, { clientY: y(10) });
    expect(column("2099-01-16")).toHaveTextContent("09:00–10:15");

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseUp(window, { clientY: y(10) });

    expect(column("2099-01-16")).not.toHaveTextContent("09:00–10:15");
    expect(rows()).toHaveLength(0);
  });

  it("does not make windows on days that are past, or from other mouse buttons", async () => {
    await renderForm();
    await openWeek();

    drag("2099-01-14", y(9), y(10));
    fireEvent.mouseDown(column("2099-01-16"), { button: 2, clientY: y(9) });
    fireEvent.mouseUp(window, { clientY: y(10) });

    expect(rows()).toHaveLength(0);
  });

  it("stops a drag at an existing window and does not start on one", async () => {
    await renderForm();
    addWindows("16.1.2099", "9", "10");
    await openWeek();

    drag("2099-01-16", y(8), y(12));
    expect(rows().map(valuesOf)).toEqual([
      ["16.01.2099", "08:00", "09:00"],
      ["16.01.2099", "09:00", "10:00"],
    ]);

    fireEvent.mouseDown(column("2099-01-16"), { button: 0, clientY: y(9, 30) });
    fireEvent.mouseUp(window, { clientY: y(11) });
    expect(rows()).toHaveLength(2);
  });

  it("selects a window by clicking it and removes it with the button", async () => {
    await renderForm();
    addWindows("16.1.2099, 19.1.2099");
    await openWeek();
    const remove = screen.getByRole("button", { name: "Ausgewähltes Zeitfenster entfernen" });
    expect(remove).toBeDisabled();

    const block = screen.getByRole("button", { name: "Zeitfenster Fr 16.01.2099, 09:00–10:00" });
    await userEvent.click(block);
    expect(block).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(remove);

    expect(rows().map((row) => valuesOf(row)[0])).toEqual(["19.01.2099"]);
    expect(remove).toBeDisabled();
  });

  it("removes a selected window with the Delete key", async () => {
    await renderForm();
    addWindows("16.1.2099");
    await openWeek();

    screen.getByRole("button", { name: "Zeitfenster Fr 16.01.2099, 09:00–10:00" }).focus();
    await userEvent.keyboard("{Delete}");

    expect(rows()).toHaveLength(0);
  });

  it("draws windows typed in the form and leaves out those it cannot read", async () => {
    await renderForm();
    await openWeek();

    addWindows("16.1.2099", "13", "14:30");
    fireEvent.change(field(rows()[0]!, "Ende"), { target: { value: "soon" } });

    expect(
      screen.queryByRole("button", { name: /^Zeitfenster Fr 16\.01\.2099/ }),
    ).not.toBeInTheDocument();
  });
});

describe("CreateTermin editing and removing time windows", () => {
  it("removes only the chosen window and moves focus to the one that took its place", async () => {
    await renderForm();
    addWindows(`${JAN_5}, ${JAN_6}, 7.1.2099`);

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    expect(rows().map((row) => valuesOf(row)[0])).toEqual(["06.01.2099", "07.01.2099"]);
    expect(field(rows()[0]!, "Datum")).toHaveFocus();
  });

  it("moves focus to the add area when the last window is removed", async () => {
    await renderForm();
    addWindows(JAN_5);

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    expect(rows()).toHaveLength(0);
    expect(addDate()).toHaveFocus();
  });

  it("gives every window a remove button", async () => {
    await renderForm();
    addWindows(`${JAN_5}, ${JAN_6}`);

    expect(removeButtons()).toHaveLength(2);
  });

  it("tidies an edited field when it loses focus and keeps what cannot be read", async () => {
    await renderForm();
    addWindows(JAN_5);
    const [row] = rows();

    fireEvent.change(field(row!, "Datum"), { target: { value: "8.1.2099" } });
    fireEvent.blur(field(row!, "Datum"));
    fireEvent.change(field(row!, "Beginn"), { target: { value: "930" } });
    fireEvent.blur(field(row!, "Beginn"));
    fireEvent.change(field(row!, "Ende"), { target: { value: "soon" } });
    fireEvent.blur(field(row!, "Ende"));

    expect(valuesOf(row!)).toEqual(["08.01.2099", "09:30", "soon"]);
  });

  it("moves an edited window to its place only when focus leaves it", async () => {
    await renderForm();
    addWindows(`${JAN_5}, ${JAN_6}`);
    const [first] = rows();

    await userEvent.clear(field(first!, "Datum"));
    await userEvent.type(field(first!, "Datum"), "9.1.2099");
    await userEvent.tab();
    // Moved from the date to the start time of the same window: still in place.
    expect(rows().map((row) => valuesOf(row)[0])).toEqual(["09.01.2099", "06.01.2099"]);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    expect(rows().map((row) => valuesOf(row)[0])).toEqual(["06.01.2099", "09.01.2099"]);
  });

  it("shows an overlap right away, naming the earlier window", async () => {
    await renderForm();
    addWindows(JAN_5, "9", "10");

    addWindows(JAN_5, "9:30", "10:30");

    const [first, second] = rows();
    expect(
      within(second!).getByText("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1."),
    ).toBeInTheDocument();
    expect(within(first!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets windows that only touch stand side by side", async () => {
    await renderForm();
    addWindows(JAN_5, "9", "10");

    addWindows(JAN_5, "10", "11");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("limit", () => {
    // 20 windows on 20 days from 1 January 2100.
    const days = Array.from({ length: MAX_SLOTS }, (_, i) => `${i + 1}.1.2100`);

    it("disables the add button with a hint at the maximum", async () => {
      await renderForm();

      addWindows(days.join(", "));

      expect(rows()).toHaveLength(MAX_SLOTS);
      expect(addButton()).toBeDisabled();
      expect(screen.getByText("Sie können höchstens 20 Zeitfenster angeben.")).toBeInTheDocument();
    });

    it("leaves out what does not fit and says so", async () => {
      await renderForm();
      addWindows(days.slice(0, 19).join(", "));

      addWindows(`${days[19]}, 1.2.2100`);

      expect(rows()).toHaveLength(MAX_SLOTS);
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 Zeitfenster hinzugefügt, 1 übersprungen (höchstens 20 Zeitfenster)",
      );
    });

    it("enables the add button again after a window is removed", async () => {
      await renderForm();
      addWindows(days.join(", "));

      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

      expect(addButton()).toBeEnabled();
      expect(
        screen.queryByText("Sie können höchstens 20 Zeitfenster angeben."),
      ).not.toBeInTheDocument();
    });
  });
});

describe("CreateTermin validation", () => {
  it("shows no errors before the first submit, even for a half-edited window", async () => {
    await renderForm();
    addWindows(JAN_5);

    fireEvent.change(field(rows()[0]!, "Beginn"), { target: { value: "x" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Aktenzeichen and window-count errors for an empty form and focuses the first", async () => {
    await renderForm();

    submit();

    expect(await screen.findByText("Geben Sie ein Aktenzeichen an.")).toBeInTheDocument();
    expect(screen.getByText(TOO_FEW)).toBeInTheDocument();
    await waitFor(() => expect(aktenzeichenInput()).toHaveFocus());
    expect(aktenzeichenInput()).toBeInvalid();
    expect(aktenzeichenInput()).toHaveAccessibleDescription("Geben Sie ein Aktenzeichen an.");
  });

  it("announces every error as an alert", async () => {
    await renderForm();

    submit();

    await screen.findByText(TOO_FEW);
    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts).toEqual(["Geben Sie ein Aktenzeichen an.", TOO_FEW]);
  });

  it("shows the window-count error when only one window is added and focuses the add area", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(JAN_5);

    submit();

    expect(await screen.findByText(TOO_FEW)).toBeInTheDocument();
    expect(screen.queryByText("Geben Sie ein Aktenzeichen an.")).not.toBeInTheDocument();
    await waitFor(() => expect(addDate()).toHaveFocus());
    expect(
      screen.getByRole("group", { name: /verfügbaren Zeitfenster/ }),
    ).toHaveAccessibleDescription(TOO_FEW);
  });

  it("clears the window-count error once a second window is added", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(JAN_5);
    submit();
    await screen.findByText(TOO_FEW);

    addWindows(JAN_6);

    await waitFor(() => expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument());
  });

  it("shows a window error in place and not the window-count error", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(`${JAN_5}, ${JAN_6}, 7.1.2099`);
    const [first, , third] = rows();
    fireEvent.change(field(third!, "Datum"), { target: { value: "40.1.2099" } });
    fireEvent.change(field(third!, "Beginn"), { target: { value: "x" } });
    fireEvent.change(field(third!, "Ende"), { target: { value: "" } });

    submit();

    const messages = await within(rows()[2]!).findAllByRole("alert");
    expect(messages.map((node) => node.textContent)).toEqual([
      "Geben Sie ein gültiges Datum an.",
      "Geben Sie eine gültige Startzeit an.",
      "Geben Sie eine gültige Endzeit an.",
    ]);
    expect(within(first!).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument();
    await waitFor(() => expect(field(rows()[2]!, "Datum")).toHaveFocus());
  });

  it("marks only the offending part of a window as invalid", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(`${JAN_5}, ${JAN_6}`);
    fireEvent.change(field(rows()[0]!, "Beginn"), { target: { value: "24" } });

    submit();

    const first = rows()[0]!;
    await within(first).findByText("Geben Sie eine gültige Startzeit an.");
    expect(field(first, "Beginn")).toBeInvalid();
    expect(field(first, "Datum")).toBeValid();
    expect(field(first, "Ende")).toBeValid();
  });

  it.each([
    [
      "a date in the past",
      "Datum",
      "5.1.2020",
      "Das Datum darf nicht in der Vergangenheit liegen.",
    ],
    ["an end before the start", "Ende", "8:00", "Die Endzeit muss nach der Startzeit liegen."],
  ] as const)("shows the error for %s", async (_name, name, value, message) => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(`${JAN_5}, ${JAN_6}`);
    fireEvent.change(field(rows()[0]!, name), { target: { value } });

    submit();

    expect(await within(rows()[0]!).findByText(message)).toBeInTheDocument();
  });

  it("keeps everything the user typed after a failed submit", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "574 C 1/26" } });
    addWindows(JAN_5, "9:30", "11");

    submit();
    await screen.findByText(TOO_FEW);

    expect(aktenzeichenInput()).toHaveValue("574 C 1/26");
    expect(valuesOf(rows()[0]!)).toEqual(["05.01.2099", "09:30", "11:00"]);
  });

  it("clears an error as soon as the user fixes it", async () => {
    await renderForm();
    submit();
    await screen.findByText("Geben Sie ein Aktenzeichen an.");

    await userEvent.type(aktenzeichenInput(), "A");

    expect(screen.queryByText("Geben Sie ein Aktenzeichen an.")).not.toBeInTheDocument();
    expect(aktenzeichenInput()).toBeValid();
    expect(screen.getByText(TOO_FEW)).toBeInTheDocument();
  });

  it("clears a window error when the window is fixed, without flagging others", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(`${JAN_5}, ${JAN_6}`);
    fireEvent.change(field(rows()[1]!, "Datum"), { target: { value: "x" } });
    submit();
    await within(rows()[1]!).findAllByRole("alert");

    fireEvent.change(field(rows()[1]!, "Datum"), { target: { value: "7.1.2099" } });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("does not flag a new problem the server did not report", async () => {
    await renderForm();
    fillValidForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "" } });
    submit();
    await screen.findByText("Geben Sie ein Aktenzeichen an.");

    fireEvent.change(field(rows()[1]!, "Datum"), { target: { value: "40.1.2099" } });

    expect(within(rows()[1]!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps window errors attached to their window after another is removed", async () => {
    await renderForm();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    addWindows(`${JAN_5}, ${JAN_6}, 7.1.2099`);
    fireEvent.change(field(rows()[2]!, "Ende"), { target: { value: "8:00" } });
    submit();
    await within(rows()[2]!).findByText("Die Endzeit muss nach der Startzeit liegen.");

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    expect(
      within(rows()[1]!).getByText("Die Endzeit muss nach der Startzeit liegen."),
    ).toBeInTheDocument();
    expect(within(rows()[0]!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the review step when everything is valid", async () => {
    await renderForm();
    fillValidForm();

    submit();

    expect(
      await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Übersicht" })).not.toBeInTheDocument();
  });

  it("saves the Terminumfrage as a draft before showing the review", async () => {
    await renderForm();
    fillValidForm();

    submit();

    await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" });
    expect(createDraftAppointment).toHaveBeenCalledOnce();
    expect(createDraftAppointment).toHaveBeenCalledWith(expect.anything(), "1", {
      aktenzeichen: "574 C 65412/26",
      // 09:00 and 10:00 Berlin time in January are 08:00 and 09:00 UTC.
      slots: [
        { start: new Date("2099-01-05T08:00:00Z"), end: new Date("2099-01-05T09:00:00Z") },
        { start: new Date("2099-01-06T08:00:00Z"), end: new Date("2099-01-06T09:00:00Z") },
      ],
    });
    expect(publishAppointment).not.toHaveBeenCalled();
  });

  it("does not save anything when the form is invalid", async () => {
    await renderForm();

    submit();

    await screen.findByText(TOO_FEW);
    expect(createDraftAppointment).not.toHaveBeenCalled();
  });
});

async function reviewStep() {
  await renderForm();
  fillValidForm();
  submit();
  await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" });
}

const sections = () => [...document.querySelectorAll("details")];

describe("CreateTermin review step", () => {
  it("summarizes the Aktenzeichen and the time windows by day", async () => {
    await reviewStep();

    const data = screen.getByRole("group", { name: "Verhandlungsdaten" });
    expect(within(data).getByText("Aktenzeichen")).toBeInTheDocument();
    expect(within(data).getByText("574 C 65412/26")).toBeInTheDocument();

    const windows = screen.getByRole("group", { name: "Zeitfenster" });
    expect(within(windows).getByText("5. Januar 2099")).toBeInTheDocument();
    expect(within(windows).getByText("6. Januar 2099")).toBeInTheDocument();
    expect(within(windows).getAllByText("09:00 – 10:00")).toHaveLength(2);
  });

  it("collapses and expands every section at once", async () => {
    await reviewStep();
    expect(sections().every((element) => element.open)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Alle ausblenden" }));
    expect(sections().every((element) => !element.open)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Alle einblenden" }));
    expect(sections().every((element) => element.open)).toBe(true);
  });

  it.each(["Zurück", "Bearbeiten Verhandlungsdaten", "Bearbeiten Zeitfenster"])(
    "%s returns to the form with the entered values",
    async (name) => {
      await reviewStep();

      await userEvent.click(screen.getByRole("button", { name }));

      expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue(
        "574 C 65412/26",
      );
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(rows().map(valuesOf)).toEqual([
        ["05.01.2099", "09:00", "10:00"],
        ["06.01.2099", "09:00", "10:00"],
      ]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("updates the saved draft instead of creating another one after going back", async () => {
    await reviewStep();
    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.change(field(rows()[0]!, "Datum"), { target: { value: "8.1.2099" } });

    submit();

    const windows = await screen.findByRole("group", { name: "Zeitfenster" });
    expect(within(windows).getByText("8. Januar 2099")).toBeInTheDocument();
    expect(createDraftAppointment).toHaveBeenCalledOnce();
    expect(updateDraftAppointment).toHaveBeenCalledOnce();
    expect(updateDraftAppointment).toHaveBeenCalledWith(
      expect.anything(),
      "1",
      "abc",
      expect.objectContaining({ aktenzeichen: "574 C 65412/26" }),
    );
  });

  it("shows the next steps when the Terminumfrage is created", async () => {
    await reviewStep();

    await userEvent.click(screen.getByRole("button", { name: "Terminumfrage erstellen" }));

    expect(
      await screen.findByRole("heading", { name: "Sie haben die Terminumfrage erstellt." }),
    ).toBeInTheDocument();
    expect(publishAppointment).toHaveBeenCalledWith(expect.anything(), "1", "abc");
  });
});
