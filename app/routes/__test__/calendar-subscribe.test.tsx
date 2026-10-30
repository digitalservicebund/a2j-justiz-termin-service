import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCalendarToken } from "~/adapters/appointments/calendar-feed.server";
import { requireUser } from "~/adapters/session/session";

import CalendarSubscribe, { loader } from "../calendar-subscribe";

vi.mock("~/adapters/appointments/calendar-feed.server", () => ({ readCalendarToken: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));
vi.mock("~/adapters/session/session", () => ({ requireUser: vi.fn() }));

const token = "7d9f4c52-6f0e-4b52-9a4a-3c1f6a0f2b11";
const feedUrl = `http://localhost:3000/verhandlungstermin-finder/api/calendars/${token}/feed.ics`;

function renderPage() {
  const Stub = createRoutesStub([
    { path: "/kalender-abonnieren", Component: CalendarSubscribe, loader },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
  ]);
  return render(<Stub initialEntries={["/kalender-abonnieren"]} />);
}

describe("CalendarSubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BASE_URL", "http://localhost:3000");
    vi.mocked(requireUser).mockResolvedValue({
      id: "u1",
      name: "Judge A",
      email: "judge.a@example.com",
      roles: ["richter"],
    });
    vi.mocked(readCalendarToken).mockResolvedValue(token);
  });

  it("shows the personal feed URL and a webcal link to it", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Kalender abonnieren" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Link zum Kalender")).toHaveValue(feedUrl);
    expect(screen.getByLabelText("Link zum Kalender")).toHaveAttribute("readonly");
    expect(screen.getByRole("link", { name: "In Kalender-App öffnen" })).toHaveAttribute(
      "href",
      feedUrl.replace("http:", "webcal:"),
    );
    expect(readCalendarToken).toHaveBeenCalledWith({ db: true }, "u1");
  });

  it("copies the feed URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Link kopieren" }));

    expect(await navigator.clipboard.readText()).toBe(feedUrl);
    expect(screen.getByRole("button", { name: "Link kopiert" })).toBeVisible();
  });

  it("explains how to subscribe in Outlook, Apple Kalender and Google Kalender", async () => {
    renderPage();

    for (const app of ["Outlook", "Apple Kalender", "Google Kalender"]) {
      expect(await screen.findByRole("heading", { level: 3, name: app })).toBeInTheDocument();
    }
  });

  it("marks the page in the sidebar", async () => {
    renderPage();

    expect(await screen.findByRole("link", { name: "Kalender abonnieren" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("answers 404 for a user without a token", async () => {
    vi.mocked(readCalendarToken).mockResolvedValue(undefined);

    await expect(loader({ request: new Request("http://localhost/x") })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("requires a signed-in user", async () => {
    const redirectResponse = new Response(null, { status: 302 });
    vi.mocked(requireUser).mockRejectedValue(redirectResponse);

    await expect(loader({ request: new Request("http://localhost/x") })).rejects.toBe(
      redirectResponse,
    );
  });
});
