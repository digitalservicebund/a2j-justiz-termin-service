import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { NotFoundPage } from "../NotFoundPage";

function renderPage() {
  const Stub = createRoutesStub([{ path: "/", Component: NotFoundPage }]);
  return render(<Stub />);
}

describe("NotFoundPage", () => {
  it("shows the 404 label, the heading and the explanation", () => {
    renderPage();

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Die Terminumfrage konnte nicht gefunden werden",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Möglicherweise wurde die Terminumfrage gelöscht/)).toBeInTheDocument();
    expect(screen.getByText(/überprüfen Sie die Schreibweise/)).toBeInTheDocument();
  });

  it("keeps the shared header and footer", () => {
    renderPage();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
