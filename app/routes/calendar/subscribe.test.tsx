import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readCalendarToken } from "~/adapters/appointments/calendar-feed.server";
import { requireUser } from "~/adapters/session/session";

import CalendarSubscribe, { loader } from "./subscribe";

vi.mock("~/adapters/appointments/calendar-feed.server", () => ({ readCalendarToken: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));
vi.mock("~/adapters/session/session", () => ({ requireUser: vi.fn() }));

const token = "7d9f4c52-6f0e-4b52-9a4a-3c1f6a0f2b11";
const feedUrl = `http://localhost:3000/verhandlungstermin-finder/api/calendars/${token}/feed.ics`;

function renderPage(entry = "/kalender-abonnieren") {
  const Stub = createRoutesStub([
    { path: "/kalender-abonnieren", Component: CalendarSubscribe, loader },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
  ]);
  return render(<Stub initialEntries={[entry]} />);
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

  const title = "Automatisch aktuelle Zeitfenster und Termine im Kalender anzeigen lassen";

  it("offers to subscribe in the calendar app through the webcal link", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Kalender in Kalender-App abonnieren" }),
    ).toHaveAttribute("href", feedUrl.replace("http:", "webcal:"));
    expect(readCalendarToken).toHaveBeenCalledWith({ db: true }, "u1");
  });

  it("lists the benefits of subscribing", async () => {
    renderPage();

    const benefits = await screen.findByRole("region", { name: "Vorteile" });
    expect(within(benefits).getAllByRole("listitem")).toHaveLength(4);
  });

  it("explains how to subscribe in Outlook, Apple and Google, collapsed", async () => {
    renderPage();

    const guides = await screen.findByRole("region", {
      name: "So abonnieren Sie den Kalender manuell auf Ihrem Computer",
    });
    const headings = within(guides).getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["Outlook", "Apple", "Google"]);
    for (const heading of headings) {
      expect(heading.closest("details")).not.toHaveAttribute("open");
    }
  });

  it("shows the feed URL in every guide, with the steps and a link to the official guide", async () => {
    renderPage();

    const outlook = (await screen.findByRole("heading", { level: 3, name: "Outlook" })).closest(
      "details",
    )!;
    expect(within(outlook).getByRole("link", { name: feedUrl })).toHaveAttribute("href", feedUrl);
    expect(
      within(outlook)
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Kopieren Sie den Kalender-Link.",
      "Öffnen Sie Ihren Outlook-Kalender und wählen Sie „Kalender hinzufügen“.",
      "Wählen Sie „Aus dem Internet abonnieren“.",
      "Fügen Sie den Kalender-Link ein.",
      "Geben Sie dem Kalender einen Namen wie zum Beispiel „Verhandlungstermin-Finder“ und klicken Sie auf „Importieren“.",
    ]);
    expect(within(outlook).getByRole("link", { name: /^Anleitung/ })).toHaveAttribute(
      "href",
      expect.stringContaining("support.microsoft.com"),
    );
    expect(screen.getAllByRole("link", { name: feedUrl })).toHaveLength(3);
  });

  it("copies the feed URL", async () => {
    const user = userEvent.setup();
    renderPage();

    const outlook = await screen.findByRole("heading", { level: 3, name: "Outlook" });
    await user.click(outlook);
    const guide = outlook.closest("details")!;
    await user.click(within(guide).getByRole("button", { name: "Kalender-Link kopieren" }));

    expect(await navigator.clipboard.readText()).toBe(feedUrl);
    expect(within(guide).getByRole("button", { name: "Kalender-Link kopiert" })).toBeVisible();
  });

  it("warns that browsers cannot open calendar links and points to the guide", async () => {
    renderPage("/kalender-abonnieren?browser");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Kalender-Links werden vom Browser nicht unterstützt.");
    expect(within(alert).getByRole("link", { name: "Zur Anleitung" })).toHaveAttribute(
      "href",
      "#anleitung",
    );
  });

  it("shows no warning when the page is opened directly", async () => {
    renderPage();

    await screen.findByRole("heading", { level: 1, name: title });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
