import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import CreateTermin from "../create-termin";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));

function renderPage() {
  const Stub = createRoutesStub([
    {
      path: "/overview/new",
      Component: CreateTermin,
      loader: () => ({
        user: {
          id: "1",
          name: "Muthig",
          email: "muthig@justiz.niedersachsen.de",
          roles: ["richter"],
        },
      }),
    },
  ]);
  return render(<Stub initialEntries={["/overview/new"]} />);
}

const rows = () => screen.findAllByRole("group", { name: /^Zeitfenster \d+$/ });

describe("CreateTermin time windows", () => {
  it("starts with three empty rows", async () => {
    renderPage();
    expect(await rows()).toHaveLength(3);
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

  it("hides the remove button when one row is left", async () => {
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));
    await userEvent.click(screen.getByRole("button", { name: "Zeitfenster 1 entfernen" }));

    expect(await rows()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /entfernen$/ })).not.toBeInTheDocument();
  });
});
