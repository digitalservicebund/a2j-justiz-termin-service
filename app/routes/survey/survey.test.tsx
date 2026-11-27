import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import { findSurvey, type Survey } from "~/adapters/appointments/survey.server";
import { windowKey } from "~/core/domain/availability";

import SurveyPage, { action, loader } from "./survey";

vi.mock("~/adapters/appointments/survey.server", () => ({ findSurvey: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const url = "http://localhost:3000/umfrage/t1";

// A window as the survey offers it: its id is the window key, which the form submits.
const offer = (slotId: string, start: string, end: string) => {
  const window = { slotId, start: new Date(start), end: new Date(end) };
  return { id: windowKey(window), ...window };
};
const w1 = offer("s1", "2026-09-17T08:00:00Z", "2026-09-17T12:00:00Z");
const w2 = offer("s2", "2026-09-21T07:00:00Z", "2026-09-21T09:00:00Z");
const w3 = offer("s3", "2026-09-21T13:30:00Z", "2026-09-21T15:00:00Z");
const [k1, k2, k3] = [w1.id, w2.id, w3.id];

// 10:00 to 14:00, 09:00 to 11:00 and 15:30 to 17:00 Berlin time in September are 08:00 to 12:00,
// 07:00 to 09:00 and 13:30 to 15:00 UTC.
const universal: Survey = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  courtCode: "B2402",
  answered: false,
  minDurationMinutes: null,
  slots: [w1, w2, w3],
  proposedSlots: [],
};
universal.proposedSlots = universal.slots.map(({ slotId, start, end }) => ({
  id: slotId,
  start,
  end,
}));

const personal: Survey = { ...universal, participant: { id: "p1", name: "Guest C" } };

function postRequest(fields: Array<[string, string]>) {
  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  return new Request(url, { method: "POST", body: form });
}

describe("survey route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
  });

  it("answers 404 for an unknown or closed survey", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(loader({ request: new Request(url), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    await expect(action({ request: postRequest([["keines", "1"]]), params })).rejects.toMatchObject(
      { init: { status: 404 } },
    );
    expect(findSurvey).toHaveBeenCalledWith({ db: true }, "t1");
  });

  it("lists the windows per day and asks the universal link for a name", async () => {
    const result = await loader({ request: new Request(url), params });

    expect(result).toMatchObject({
      aktenzeichen: "574 C 65412/26",
      needsName: true,
      values: { name: "", available: [], none: false },
    });
    expect(result.days.map(({ label, windows }) => [label, windows.length])).toEqual([
      ["17. September 2026", 1],
      ["21. September 2026", 2],
    ]);
  });

  it("does not ask a personal link for a name and brings an earlier answer along", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const result = await loader({
      request: new Request(`${url}?verfuegbar=${k2}&keines=1`),
      params,
    });

    expect(result).toMatchObject({
      needsName: false,
      values: { available: [k2], none: true },
    });
  });

  it("sends a personal link that has answered to its result", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...personal, answered: true });

    const thrown = await callLoader(loader, { request: new Request(url), params });

    expect(thrown).toMatchObject({
      thrown: true,
      status: 302,
      location: "/umfrage/t1/naechste-schritte?teilnehmer=p1",
    });
  });

  it("continues to the review with a valid answer", async () => {
    const response = await callAction(action, {
      request: postRequest([
        ["name", "Guest C"],
        ["verfuegbar", k1],
        ["verfuegbar", k3],
      ]),
      params,
    });

    expect(response.status).toBe(302);
    expect(response.location).toBe(
      `/umfrage/t1/zusammenfassung?name=Guest+C&verfuegbar=${k1}&verfuegbar=${k3}`,
    );
  });

  it("does not continue to the review when no window is left", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [] });

    const response = await callAction(action, {
      request: postRequest([
        ["name", "Guest C"],
        ["keines", "1"],
      ]),
      params,
    });

    expect(response.location).toBe("/umfrage/t1");
  });

  it("continues to the review when no window fits", async () => {
    const response = await callAction(action, {
      request: postRequest([
        ["name", "Guest C"],
        ["keines", "1"],
      ]),
      params,
    });

    expect(response.location).toBe("/umfrage/t1/zusammenfassung?name=Guest+C&keines=1");
  });

  it("answers 400 with the entered values when the name is missing", async () => {
    const response = await callAction(action, {
      request: postRequest([["verfuegbar", k1]]),
      params,
    });

    expect(response.status).toBe(400);
    expect(response.data).toEqual({
      values: { name: "", available: [k1], none: false },
      errors: { name: "Geben Sie Ihren Namen an." },
    });
  });

  it("answers 400 for a window that is no longer offered", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const response = await callAction(action, {
      request: postRequest([["verfuegbar", "hidden"]]),
      params,
    });

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty("errors", {
      slots: "Mindestens ein Zeitfenster steht nicht mehr zur Auswahl.",
    });
  });

  it("does not need a name for a personal link", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const response = await callAction(action, {
      request: postRequest([["verfuegbar", k2]]),
      params,
    });

    expect(response.location).toBe(`/umfrage/t1/zusammenfassung?verfuegbar=${k2}`);
  });
});

function renderSurvey(initialEntries = ["/umfrage/t1"]) {
  const Stub = createRoutesStub([
    { path: "/umfrage/:token", Component: SurveyPage, loader, action },
    { path: "/umfrage/:token/zusammenfassung", Component: () => <h1>Review page</h1> },
  ]);
  render(<Stub initialEntries={initialEntries} />);
}

describe("survey page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
  });

  it("shows the Aktenzeichen, the windows per day and the option that none fits", async () => {
    renderSurvey();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Geben Sie Ihre Verfügbarkeiten an" }),
    ).toBeVisible();
    expect(screen.getByText("574 C 65412/26")).toBeVisible();
    expect(screen.getByText("Gericht")).toBeVisible();
    expect(screen.getByText("Amtsgericht Biberach an der Riß")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "21. September 2026" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "15:30 bis 17:00" })).toBeVisible();
    expect(screen.getAllByRole("checkbox", { name: /^Verfügbar/ })).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "Kein Zeitfenster passt" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeVisible();
  });

  it("asks for a name only behind the universal link", async () => {
    renderSurvey();
    expect(await screen.findByRole("textbox", { name: "Ihr Name" })).toBeVisible();
  });

  it("does not ask a personal link for a name", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);
    renderSurvey();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("textbox", { name: "Ihr Name" })).not.toBeInTheDocument();
  });

  it("offers no window another participant ruled out", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: universal.slots.slice(0, 1) });
    renderSurvey();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("checkbox", { name: /^Verfügbar/ })).toHaveLength(1);
    expect(screen.queryByText("21. September 2026")).not.toBeInTheDocument();
  });

  it("shows the sorry page right away when every window is ruled out", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [] });
    renderSurvey();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Es gibt leider kein Zeitfenster, dass allen Verfahrensbeteiligten passt.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Das Gericht wird wahrscheinlich eine neue Terminumfrage erstellen."),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weiter" })).not.toBeInTheDocument();
    // Guests have no sidebar and nothing to start; they can only report a problem.
    expect(screen.queryByRole("navigation", { name: "Bereiche" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Terminumfrage erstellen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Problem mit dieser Seite melden" })).toBeVisible();

    const facts = screen.getByRole("heading", { name: "Verhandlungsdaten" }).closest("section")!;
    expect(within(facts).getByText("Aktenzeichen")).toBeVisible();
    expect(within(facts).getByText("574 C 65412/26")).toBeVisible();
    expect(within(facts).getByText("Gericht")).toBeVisible();
    expect(within(facts).getByText("Amtsgericht Biberach an der Riß")).toBeVisible();

    const windows = screen.getByRole("heading", { name: "Zeitfenster" }).closest("section")!;
    expect(within(windows).getByText("17. September 2026")).toBeVisible();
    expect(within(windows).getByText("10:00 bis 14:00")).toBeVisible();
    expect(within(windows).getByText("21. September 2026")).toBeVisible();
    expect(within(windows).getByText("09:00 bis 11:00")).toBeVisible();
    expect(within(windows).getByText("15:30 bis 17:00")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Brotkrumen" })).toHaveTextContent(
      "Verhandlungstermin-FinderTerminumfrage",
    );
  });

  it("lists no Zeitfenster on the sorry page when nothing was proposed", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [], proposedSlots: [] });
    renderSurvey();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Zeitfenster" })).toBeNull();
  });

  it("offers the ruled-out windows to the page only once none is left", async () => {
    const open = await loader({ request: new Request(url), params });
    expect(open.proposedDays).toEqual([]);

    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [] });
    const cancelled = await loader({ request: new Request(url), params });
    expect(cancelled.proposedDays.map(({ label }) => label)).toEqual([
      "17. September 2026",
      "21. September 2026",
    ]);
  });

  it("keeps an earlier answer when the guest comes back from the review", async () => {
    renderSurvey([`/umfrage/t1?name=Guest+C&verfuegbar=${k3}`]);

    expect(await screen.findByRole("textbox", { name: "Ihr Name" })).toHaveValue("Guest C");
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 21. September 2026, 15:30 bis 17:00" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 17. September 2026, 10:00 bis 14:00" }),
    ).not.toBeChecked();
  });
});

// Submits the survey with a name and the button that was pressed.
const submit = async (intent: string, extra: Array<[string, string]> = []) =>
  await callAction(action, {
    request: postRequest([["name", "Guest C"], ["intent", intent], ...extra]),
    params,
  });

describe("smaller windows on the survey", () => {
  // 11:00 to 12:30 and 13:00 to 14:00 Berlin time within the first offered window.
  const late = { slotId: "s1", start: new Date("2026-09-17T09:00:00Z"), end: w1.end };
  const early = {
    slotId: "s1",
    start: new Date("2026-09-17T09:00:00Z"),
    end: new Date("2026-09-17T10:30:00Z"),
  };
  const lateKey = windowKey(late);
  const earlyKey = windowKey(early);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
  });

  it("goes to the page of a new smaller window with the draft, without checking it", async () => {
    const response = await submit(`add:${k1}`, [["verfuegbar", k2]]);

    expect(response.status).toBe(302);
    expect(response.location).toBe(
      `/umfrage/t1/zeitfenster?name=Guest+C&verfuegbar=${k2}&angebot=${k1}`,
    );
  });

  it("goes to the page of a smaller window to change it", async () => {
    const response = await submit(`edit:${k1}:${earlyKey}`, [["verfuegbar", earlyKey]]);

    expect(response.location).toBe(
      `/umfrage/t1/zeitfenster?name=Guest+C&verfuegbar=${earlyKey}&angebot=${k1}&fenster=${earlyKey}`,
    );
  });

  it("removes a smaller window and comes back to its offered window", async () => {
    const response = await submit(`delete:${k1}:${earlyKey}`, [
      ["verfuegbar", earlyKey],
      ["verfuegbar", k3],
    ]);

    expect(response.location).toBe(`/umfrage/t1?name=Guest+C&verfuegbar=${k3}#zeitfenster-${k1}`);
  });

  it("checks the answer as before when the guest continues", async () => {
    const response = await callAction(action, {
      request: postRequest([["intent", "next"]]),
      params,
    });

    expect(response).toMatchObject({ thrown: false, status: 400 });
  });

  it("shows a partly answered window with its smaller windows instead of the box", async () => {
    renderSurvey([`/umfrage/t1?verfuegbar=${earlyKey}&verfuegbar=${k3}`]);

    expect(await screen.findByText("Teilweise verfügbar")).toBeVisible();
    expect(screen.getByText("11:00 bis 12:30 – verfügbar")).toBeVisible();
    expect(
      screen.queryByRole("checkbox", { name: "Verfügbar am 17. September 2026, 10:00 bis 14:00" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Zeitfenster 11:00 bis 12:30 am 17. September 2026, 10:00 bis 14:00 ändern",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Zeitfenster 11:00 bis 12:30 am 17. September 2026, 10:00 bis 14:00 löschen",
      }),
    ).toBeVisible();
    // The other windows keep their box; the third is ticked.
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 21. September 2026, 15:30 bis 17:00" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 21. September 2026, 09:00 bis 11:00" }),
    ).not.toBeChecked();
  });

  it("ticks the box once the smaller windows cover the offered window", async () => {
    const before = { slotId: "s1", start: w1.start, end: late.start };
    renderSurvey([`/umfrage/t1?verfuegbar=${windowKey(before)}&verfuegbar=${lateKey}`]);

    expect(
      await screen.findByRole("checkbox", {
        name: "Verfügbar am 17. September 2026, 10:00 bis 14:00",
      }),
    ).toBeChecked();
    expect(screen.queryByText("Teilweise verfügbar")).toBeNull();
  });

  it("offers to add a smaller window to every offered window", async () => {
    renderSurvey();

    const buttons = await screen.findAllByRole("button", {
      name: /^Kleineres Zeitfenster hinzufügen am /,
    });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAccessibleName(
      "Kleineres Zeitfenster hinzufügen am 17. September 2026, 10:00 bis 14:00",
    );
  });

  it("keeps the smaller windows when the guest continues", async () => {
    let submitted: FormData | undefined;
    const Stub = createRoutesStub([
      {
        path: "/umfrage/:token",
        Component: SurveyPage,
        loader,
        action: async ({ request }) => {
          submitted = await request.clone().formData();
          return action({ request, params });
        },
      },
      { path: "/umfrage/:token/zusammenfassung", Component: () => <h1>Review page</h1> },
    ]);
    render(<Stub initialEntries={[`/umfrage/t1?name=Guest+C&verfuegbar=${earlyKey}`]} />);

    await userEvent.click(await screen.findByRole("button", { name: "Weiter" }));

    expect(await screen.findByRole("heading", { name: "Review page" })).toBeVisible();
    expect(submitted?.getAll("verfuegbar")).toEqual([earlyKey]);
    expect(submitted?.get("intent")).toBe("next");
  });

  it("continues, not adds, when the guest presses Enter in the name field", async () => {
    renderSurvey(["/umfrage/t1"]);

    const name = await screen.findByRole("textbox", { name: "Ihr Name" });
    await userEvent.type(name, "Guest C{Enter}");

    // The answer is checked as for "Weiter": nothing is ticked yet.
    expect(
      await screen.findByText(
        "Wählen Sie mindestens ein Zeitfenster aus oder geben Sie an, dass kein Zeitfenster passt.",
      ),
    ).toBeVisible();
  });
});

describe("weekday and cancelling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
  });

  it("names the weekday under every date", async () => {
    renderSurvey();

    expect(await screen.findByText("Donnerstag")).toBeVisible();
    expect(screen.getByText("Montag")).toBeVisible();
  });
});
