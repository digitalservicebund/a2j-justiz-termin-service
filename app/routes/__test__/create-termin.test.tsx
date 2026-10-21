import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import CreateTermin, { action } from "../create-termin";
import { MAX_SLOTS, type SlotInput } from "../create-termin.schema";

vi.mock("~/adapters/session/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    id: "1",
    name: "Muthig",
    email: "muthig@justiz.niedersachsen.de",
    roles: ["richter"],
  }),
}));

function renderPage() {
  const Stub = createRoutesStub([
    {
      path: "/overview/new",
      Component: CreateTermin,
      action,
      loader: () => ({
        user: {
          id: "1",
          name: "Muthig",
          email: "muthig@justiz.niedersachsen.de",
          roles: ["richter"],
        },
      }),
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

  it("goes to the overview when everything is valid", async () => {
    renderPage();
    await fillValidForm();

    submit();

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
  });
});
