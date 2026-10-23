import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findSurvey, type Survey } from "~/adapters/appointments/survey.server";

import SurveyPage, { action, loader } from "../survey";

vi.mock("~/adapters/appointments/survey.server", () => ({ findSurvey: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const url = "http://localhost:3000/umfrage/t1";

// 10:00 to 14:00, 09:00 to 11:00 and 15:30 to 17:00 Berlin time in September are 08:00 to 12:00,
// 07:00 to 09:00 and 13:30 to 15:00 UTC.
const universal: Survey = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  answered: false,
  slots: [
    { id: "s1", start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
    { id: "s2", start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T09:00:00Z") },
    { id: "s3", start: new Date("2026-09-21T13:30:00Z"), end: new Date("2026-09-21T15:00:00Z") },
  ],
};

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

    const result = await loader({ request: new Request(`${url}?verfuegbar=s2&keines=1`), params });

    expect(result).toMatchObject({
      needsName: false,
      values: { available: ["s2"], none: true },
    });
  });

  it("sends a personal link that has answered to its result", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...personal, answered: true });

    const thrown = (await loader({ request: new Request(url), params }).catch(
      (error: Response) => error,
    )) as Response;

    expect(thrown.status).toBe(302);
    expect(thrown.headers.get("Location")).toBe("/umfrage/t1/naechste-schritte?teilnehmer=p1");
  });

  it("continues to the review with a valid answer", async () => {
    const response = (await action({
      request: postRequest([
        ["name", "Guest C"],
        ["verfuegbar", "s1"],
        ["verfuegbar", "s3"],
      ]),
      params,
    })) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/umfrage/t1/zusammenfassung?name=Guest+C&verfuegbar=s1&verfuegbar=s3",
    );
  });

  it("does not continue to the review when no window is left", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [] });

    const response = (await action({
      request: postRequest([
        ["name", "Guest C"],
        ["keines", "1"],
      ]),
      params,
    })) as Response;

    expect(response.headers.get("Location")).toBe("/umfrage/t1");
  });

  it("continues to the review when no window fits", async () => {
    const response = (await action({
      request: postRequest([
        ["name", "Guest C"],
        ["keines", "1"],
      ]),
      params,
    })) as Response;

    expect(response.headers.get("Location")).toBe(
      "/umfrage/t1/zusammenfassung?name=Guest+C&keines=1",
    );
  });

  it("answers 400 with the entered values when the name is missing", async () => {
    const response = (await action({
      request: postRequest([["verfuegbar", "s1"]]),
      params,
    })) as { init: { status: number }; data: unknown };

    expect(response.init.status).toBe(400);
    expect(response.data).toEqual({
      values: { name: "", available: ["s1"], none: false },
      errors: { name: "Geben Sie Ihren Namen an." },
    });
  });

  it("answers 400 for a window that is no longer offered", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const response = (await action({
      request: postRequest([["verfuegbar", "hidden"]]),
      params,
    })) as { init: { status: number }; data: { errors: unknown } };

    expect(response.init.status).toBe(400);
    expect(response.data.errors).toEqual({
      slots: "Mindestens ein Zeitfenster steht nicht mehr zur Auswahl.",
    });
  });

  it("does not need a name for a personal link", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const response = (await action({
      request: postRequest([["verfuegbar", "s2"]]),
      params,
    })) as Response;

    expect(response.headers.get("Location")).toBe("/umfrage/t1/zusammenfassung?verfuegbar=s2");
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
        name: "Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weiter" })).not.toBeInTheDocument();
  });

  it("keeps an earlier answer when the guest comes back from the review", async () => {
    renderSurvey(["/umfrage/t1?name=Guest+C&verfuegbar=s3"]);

    expect(await screen.findByRole("textbox", { name: "Ihr Name" })).toHaveValue("Guest C");
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 21. September 2026, 15:30 bis 17:00" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 17. September 2026, 10:00 bis 14:00" }),
    ).not.toBeChecked();
  });

  it("shows what is missing and keeps what was entered", async () => {
    renderSurvey();

    await userEvent.type(await screen.findByRole("textbox", { name: "Ihr Name" }), "Guest C");
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));

    expect(
      await screen.findByText(
        "Wählen Sie mindestens ein Zeitfenster aus oder geben Sie an, dass kein Zeitfenster passt.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Ihr Name" })).toHaveValue("Guest C");
    expect(screen.queryByText("Geben Sie Ihren Namen an.")).not.toBeInTheDocument();
  });

  it("shows the missing name next to the field", async () => {
    renderSurvey();

    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Verfügbar am 17. September 2026, 10:00 bis 14:00",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByText("Geben Sie Ihren Namen an.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Ihr Name" })).toBeInvalid();
    // The ticked window stays ticked.
    expect(
      screen.getByRole("checkbox", { name: "Verfügbar am 17. September 2026, 10:00 bis 14:00" }),
    ).toBeChecked();
  });

  it("rejects windows ticked together with the option that none fits", async () => {
    renderSurvey();

    await userEvent.type(await screen.findByRole("textbox", { name: "Ihr Name" }), "Guest C");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Verfügbar am 17. September 2026, 10:00 bis 14:00" }),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Kein Zeitfenster passt" }));
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));

    expect(
      await screen.findByText(
        "Sie können nicht zugleich Zeitfenster auswählen und angeben, dass keines passt.",
      ),
    ).toBeVisible();
  });

  it("continues to the review with a valid answer", async () => {
    renderSurvey();

    await userEvent.type(await screen.findByRole("textbox", { name: "Ihr Name" }), "Guest C");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Verfügbar am 21. September 2026, 09:00 bis 11:00" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByRole("heading", { name: "Review page" })).toBeVisible();
  });
});
