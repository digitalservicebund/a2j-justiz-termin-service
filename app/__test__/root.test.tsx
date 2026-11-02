import { render, screen } from "@testing-library/react";
import { createRoutesStub, data, useRouteError } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { NOT_FOUND_TITLE } from "~/components/shared/NotFoundPage";
import { PAGE_TITLE } from "~/lib/page-meta";

import { ErrorBoundary, Layout } from "../root";

vi.mock("~/adapters/session/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("~/lib/env", () => ({ requireEnv: () => "http://localhost:3000" }));

// The router hands the thrown value to the boundary; the stub does the same through the hook.
function Boundary() {
  return <ErrorBoundary error={useRouteError()} params={{}} />;
}

function renderFailing(thrown: () => never) {
  const Stub = createRoutesStub([
    {
      path: "/",
      loader: thrown,
      Component: () => null,
      ErrorBoundary: Boundary,
    },
  ]);
  return render(<Stub />);
}

describe("root error boundary", () => {
  it("shows the not-found page for a 404", async () => {
    renderFailing(() => {
      throw data("Not found", { status: 404 });
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Die Terminumfrage konnte nicht gefunden werden",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Error 404")).not.toBeInTheDocument();
  });

  it("keeps the generic error for other statuses", async () => {
    renderFailing(() => {
      throw data("Nope", { status: 403, statusText: "Forbidden" });
    });

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(screen.queryByText("404")).not.toBeInTheDocument();
  });

  it("keeps the generic error for an unexpected exception", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderFailing(() => {
      throw new Error("boom");
    });

    // Outside production the message of the exception is shown.
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("404")).not.toBeInTheDocument();
  });
});

function renderLayout(thrown?: () => never) {
  const Stub = createRoutesStub([
    {
      path: "/",
      loader: thrown,
      Component: () => <Layout>content</Layout>,
      ErrorBoundary: () => <Layout>content</Layout>,
    },
  ]);
  render(<Stub />);
}

describe("root layout title", () => {
  it("names the survey in the title of a 404", async () => {
    renderLayout(() => {
      throw data("Not found", { status: 404 });
    });
    await screen.findByText("content");
    expect(document.title).toBe(NOT_FOUND_TITLE);
  });

  it("keeps the service title otherwise", async () => {
    renderLayout();
    await screen.findByText("content");
    expect(document.title).toBe(PAGE_TITLE);
  });
});
