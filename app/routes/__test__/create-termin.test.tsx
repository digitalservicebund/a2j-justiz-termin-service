import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { MAX_SLOTS, type SlotInput } from "../create-termin.schema";

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
    name: "Muthig",
    email: "muthig@justiz.niedersachsen.de",
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
  ]);
  return render(<Stub initialEntries={["/overview/new"]} />);
}

const TOO_FEW = "Geben Sie mindestens zwei Zeitfenster an.";

const rows = () => screen.findAllByRole("group", { name: /^Zeitfenster \d+$/ });
const aktenzeichenInput = () => screen.getByRole("textbox", { name: "Aktenzeichen" });
const removeButtons = () => screen.getAllByRole("button", { name: /^Zeitfenster \d+ entfernen$/ });

const labels: Record<keyof SlotInput, [string, number]> = {
  day: ["Tag", 0],
  month: ["Monat", 0],
  year: ["Jahr", 0],
  startHour: ["Stunde", 0],
  startMinute: ["Minute", 0],
  endHour: ["Stunde", 1],
  endMinute: ["Minute", 1],
};

// Far in the future so the "no past dates" rule never trips these tests.
const validSlot = (day: string): SlotInput => ({
  day,
  month: "1",
  year: "2099",
  startHour: "9",
  startMinute: "0",
  endHour: "10",
  endMinute: "0",
});

function fillRow(row: HTMLElement, slot: Partial<SlotInput>) {
  for (const [field, value] of Object.entries(slot)) {
    const [label, position] = labels[field as keyof SlotInput];
    const input = within(row).getAllByRole("textbox", { name: label })[position]!;
    fireEvent.change(input, { target: { value } });
  }
}

async function fillValidForm() {
  const [first, second] = await rows();
  fireEvent.change(aktenzeichenInput(), { target: { value: "574 C 65412/26" } });
  fillRow(first!, validSlot("5"));
  fillRow(second!, validSlot("6"));
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

describe("CreateTermin time windows", () => {
  it("starts with three empty rows, each with a remove button", async () => {
    renderPage();
    expect(await rows()).toHaveLength(3);
    expect(removeButtons()).toHaveLength(3);
  });

  it("adds a row with the add button", async () => {
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));

    expect(await rows()).toHaveLength(4);
  });

  it("removes only the chosen row and keeps the others' input", async () => {
    renderPage();
    const [first, second] = await rows();
    await userEvent.type(within(first!).getByRole("textbox", { name: "Tag" }), "1");
    await userEvent.type(within(second!).getByRole("textbox", { name: "Tag" }), "2");

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    const remaining = await rows();
    expect(remaining).toHaveLength(2);
    expect(within(remaining[0]!).getByRole("textbox", { name: "Tag" })).toHaveValue("2");
  });

  it("limits each segment to its maximum length", async () => {
    renderPage();
    const [first] = await rows();
    const day = within(first!).getByRole("textbox", { name: "Tag" });

    await userEvent.type(day, "123");

    expect(day).toHaveValue("12");
  });

  describe("removing below the minimum", () => {
    it("refuses to remove the second-to-last row and shows the error instead", async () => {
      renderPage();
      await rows();
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));
      expect(await rows()).toHaveLength(2);
      expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

      expect(await rows()).toHaveLength(2);
      expect(screen.getByText(TOO_FEW)).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: /verfügbaren Zeitfenster/ }),
      ).toHaveAccessibleDescription(TOO_FEW);
    });

    it("keeps the remove buttons visible while two rows are left", async () => {
      renderPage();
      await rows();
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

      expect(removeButtons()).toHaveLength(2);
    });

    it("hides the error again when a row is added", async () => {
      renderPage();
      await rows();
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));
      expect(screen.getByText(TOO_FEW)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));

      expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument();
      expect(await rows()).toHaveLength(3);
    });

    it("hides the error again when the user edits a row", async () => {
      renderPage();
      await rows();
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));
      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

      const [first] = await rows();
      await userEvent.type(within(first!).getByRole("textbox", { name: "Tag" }), "1");

      expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument();
    });
  });

  describe("row limit", () => {
    it("disables the add button with a hint at the maximum", async () => {
      renderPage();
      await rows();
      const add = screen.getByRole("button", { name: "Zeitfenster hinzufügen" });

      // The page starts with 3 rows; one click short of the limit the button is still enabled.
      for (let count = 3; count < MAX_SLOTS - 1; count++) await userEvent.click(add);
      expect(add).toBeEnabled();
      await userEvent.click(add);

      expect(await rows()).toHaveLength(MAX_SLOTS);
      expect(add).toBeDisabled();
      expect(screen.getByText("Sie können höchstens 20 Zeitfenster angeben.")).toBeInTheDocument();
    });

    it("enables the add button again after a row is removed", async () => {
      renderPage();
      await rows();
      const add = screen.getByRole("button", { name: "Zeitfenster hinzufügen" });
      for (let count = 3; count < MAX_SLOTS; count++) await userEvent.click(add);
      expect(add).toBeDisabled();

      await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

      expect(add).toBeEnabled();
      expect(
        screen.queryByText("Sie können höchstens 20 Zeitfenster angeben."),
      ).not.toBeInTheDocument();
    });
  });
});

describe("CreateTermin validation", () => {
  it("shows no errors before the first submit, even for a half-filled row", async () => {
    renderPage();
    const [first] = await rows();

    await userEvent.type(within(first!).getByRole("textbox", { name: "Tag" }), "9");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Aktenzeichen and window-count errors for an empty form and focuses the first", async () => {
    renderPage();
    await rows();

    submit();

    expect(await screen.findByText("Geben Sie ein Aktenzeichen an.")).toBeInTheDocument();
    expect(screen.getByText(TOO_FEW)).toBeInTheDocument();
    await waitFor(() => expect(aktenzeichenInput()).toHaveFocus());
    expect(aktenzeichenInput()).toBeInvalid();
    expect(aktenzeichenInput()).toHaveAccessibleDescription("Geben Sie ein Aktenzeichen an.");
  });

  it("announces every error as an alert", async () => {
    renderPage();
    await rows();

    submit();

    await screen.findByText(TOO_FEW);
    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
    expect(alerts).toEqual(["Geben Sie ein Aktenzeichen an.", TOO_FEW]);
  });

  it("shows the window-count error when only one window is filled in", async () => {
    renderPage();
    const [first] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));

    submit();

    expect(await screen.findByText(TOO_FEW)).toBeInTheDocument();
    expect(screen.queryByText("Geben Sie ein Aktenzeichen an.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Zeitfenster hinzufügen" })).toHaveFocus(),
    );
  });

  it("shows a row error in place and not the window-count error", async () => {
    renderPage();
    const [first, second, third] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));
    fillRow(second!, validSlot("6"));
    fillRow(third!, { day: "40", month: "1", year: "2099" });

    submit();

    const message = await within(third!).findAllByRole("alert");
    expect(message.map((node) => node.textContent)).toEqual([
      "Geben Sie ein gültiges Datum an.",
      "Geben Sie eine gültige Startzeit an.",
      "Geben Sie eine gültige Endzeit an.",
    ]);
    expect(within(first!).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument();
    await waitFor(() => expect(within(third!).getByRole("textbox", { name: "Tag" })).toHaveFocus());
  });

  it("marks only the offending part of a row as invalid", async () => {
    renderPage();
    const [first, second] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, { ...validSlot("5"), startHour: "24" });
    fillRow(second!, validSlot("6"));

    submit();

    await within(first!).findByText("Geben Sie eine gültige Startzeit an.");
    expect(within(first!).getAllByRole("textbox", { name: "Stunde" })[0]).toBeInvalid();
    expect(within(first!).getByRole("textbox", { name: "Tag" })).toBeValid();
    expect(within(first!).getAllByRole("textbox", { name: "Stunde" })[1]).toBeValid();
  });

  it.each([
    ["a date in the past", { year: "2020" }, "Das Datum darf nicht in der Vergangenheit liegen."],
    ["an end before the start", { endHour: "8" }, "Die Endzeit muss nach der Startzeit liegen."],
  ])("shows the error for %s", async (_name, overrides, message) => {
    renderPage();
    const [first, second] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, { ...validSlot("5"), ...overrides });
    fillRow(second!, validSlot("6"));

    submit();

    expect(await within(first!).findByText(message)).toBeInTheDocument();
  });

  it("shows which earlier row an overlapping window collides with", async () => {
    renderPage();
    const [first, second] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));
    fillRow(second!, validSlot("5"));

    submit();

    expect(
      await within(second!).findByText("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1."),
    ).toBeInTheDocument();
    expect(within(first!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps everything the user typed after a failed submit", async () => {
    renderPage();
    const [first] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "574 C 1/26" } });
    fillRow(first!, { day: "9", month: "1" });

    submit();
    await screen.findAllByRole("alert");

    expect(aktenzeichenInput()).toHaveValue("574 C 1/26");
    expect(within(first!).getByRole("textbox", { name: "Tag" })).toHaveValue("9");
    expect(within(first!).getByRole("textbox", { name: "Monat" })).toHaveValue("1");
  });

  it("clears an error as soon as the user fixes it", async () => {
    renderPage();
    await rows();
    submit();
    await screen.findByText("Geben Sie ein Aktenzeichen an.");

    await userEvent.type(aktenzeichenInput(), "A");

    expect(screen.queryByText("Geben Sie ein Aktenzeichen an.")).not.toBeInTheDocument();
    expect(aktenzeichenInput()).toBeValid();
    expect(screen.getByText(TOO_FEW)).toBeInTheDocument();
  });

  it("clears the window-count error once enough windows are valid", async () => {
    renderPage();
    const [first, second] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));
    submit();
    await screen.findByText(TOO_FEW);

    fillRow(second!, validSlot("6"));

    await waitFor(() => expect(screen.queryByText(TOO_FEW)).not.toBeInTheDocument());
  });

  it("clears a row error when the row is fixed, without flagging other rows", async () => {
    renderPage();
    const [first, second, third] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));
    fillRow(second!, validSlot("6"));
    fillRow(third!, { day: "9" });
    submit();
    await within(third!).findAllByRole("alert");

    fillRow(third!, { ...validSlot("7") });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("does not flag a new problem the server did not report", async () => {
    renderPage();
    const [first, second] = await rows();
    await fillValidForm();
    fillRow(first!, validSlot("5"));
    fillRow(second!, validSlot("6"));
    fireEvent.change(aktenzeichenInput(), { target: { value: "" } });
    submit();
    await screen.findByText("Geben Sie ein Aktenzeichen an.");

    fillRow(second!, { day: "40" });

    expect(within(second!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps row errors attached to their row after another row is removed", async () => {
    renderPage();
    const [first, second, third] = await rows();
    fireEvent.change(aktenzeichenInput(), { target: { value: "A 1" } });
    fillRow(first!, validSlot("5"));
    fillRow(second!, validSlot("6"));
    fillRow(third!, { ...validSlot("7"), endHour: "8" });
    submit();
    await within(third!).findByText("Die Endzeit muss nach der Startzeit liegen.");

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    const remaining = await rows();
    expect(
      within(remaining[1]!).getByText("Die Endzeit muss nach der Startzeit liegen."),
    ).toBeInTheDocument();
    expect(within(remaining[0]!).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the review step when everything is valid", async () => {
    renderPage();
    await fillValidForm();

    submit();

    expect(
      await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Übersicht" })).not.toBeInTheDocument();
  });

  it("saves the Terminumfrage as a draft before showing the review", async () => {
    renderPage();
    await fillValidForm();

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
    renderPage();
    await rows();

    submit();

    await screen.findByText(TOO_FEW);
    expect(createDraftAppointment).not.toHaveBeenCalled();
  });
});

async function reviewStep() {
  renderPage();
  await fillValidForm();
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
      const [first, second] = await rows();
      expect(within(first!).getAllByRole("textbox", { name: "Tag" })[0]).toHaveValue("05");
      expect(within(second!).getAllByRole("textbox", { name: "Tag" })[0]).toHaveValue("06");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("updates the saved draft instead of creating another one after going back", async () => {
    await reviewStep();
    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
    const [first] = await rows();
    fireEvent.change(within(first!).getAllByRole("textbox", { name: "Tag" })[0]!, {
      target: { value: "8" },
    });

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

  it("goes to the overview when the Terminumfrage is created", async () => {
    await reviewStep();

    await userEvent.click(screen.getByRole("button", { name: "Terminumfrage erstellen" }));

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    expect(publishAppointment).toHaveBeenCalledWith(expect.anything(), "1", "abc");
  });
});
