import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findSurvey, saveAnswer, type Survey } from "~/adapters/appointments/survey.server";

import SurveyConfirm, { action, loader } from "../survey.confirm";

vi.mock("~/adapters/appointments/survey.server", () => ({
  findSurvey: vi.fn(),
  saveAnswer: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const url = "http://localhost:3000/umfrage/t1/zusammenfassung";
const query = "?name=Guest+C&verfuegbar=s1&verfuegbar=s3";

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

const personal: Survey = { ...universal, participant: { id: "p1", name: "Guest D" } };

const locationOf = (response: unknown) => (response as Response).headers.get("Location");

function postRequest(fields: Array<[string, string]>) {
  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  return new Request(url, { method: "POST", body: form });
}

const finish: Array<[string, string]> = [
  ["intent", "finish"],
  ["name", "Guest C"],
  ["verfuegbar", "s1"],
  ["verfuegbar", "s3"],
];

describe("survey confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
    vi.mocked(saveAnswer).mockResolvedValue({ saved: true, participantId: "p9" });
  });

  it("answers 404 for an unknown or closed survey", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(loader({ request: new Request(url + query), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    await expect(action({ request: postRequest(finish), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(saveAnswer).not.toHaveBeenCalled();
  });

  it("lists the answer per window for review", async () => {
    const result = await loader({ request: new Request(url + query), params });

    expect(result).toMatchObject({
      aktenzeichen: "574 C 65412/26",
      name: "Guest C",
      needsName: true,
      none: false,
      values: { name: "Guest C", available: ["s1", "s3"], none: false },
      answers: [
        { label: "17. September 2026", lines: ["10:00 – verfügbar"] },
        { label: "21. September 2026", lines: ["09:00 – nicht verfügbar", "15:30 – verfügbar"] },
      ],
    });
  });

  it("marks everything as unavailable when no window fits", async () => {
    const result = await loader({
      request: new Request(`${url}?name=Guest+C&keines=1`),
      params,
    });

    expect(result.none).toBe(true);
    expect(result.answers.flatMap(({ lines }) => lines)).toEqual([
      "10:00 – nicht verfügbar",
      "09:00 – nicht verfügbar",
      "15:30 – nicht verfügbar",
    ]);
  });

  it("names the guest of a personal link without asking", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const result = await loader({ request: new Request(`${url}?verfuegbar=s2`), params });

    expect(result).toMatchObject({ name: "Guest D", needsName: false });
  });

  it("sends an invalid answer back to the form", async () => {
    for (const search of [
      "",
      "?verfuegbar=s1",
      "?name=Guest+C",
      "?name=Guest+C&verfuegbar=s1&keines=1",
      "?name=Guest+C&verfuegbar=hidden",
    ]) {
      const thrown = (await loader({ request: new Request(url + search), params }).catch(
        (error: Response) => error,
      )) as Response;
      expect(thrown.status).toBe(302);
      expect(thrown.headers.get("Location")).toMatch(/^\/umfrage\/t1\?/);
    }
  });

  it("goes back to the form with the answer", async () => {
    const response = await action({
      request: postRequest([["intent", "back"], ...finish.slice(1)]),
      params,
    });

    expect(locationOf(response)).toBe("/umfrage/t1?name=Guest+C&verfuegbar=s1&verfuegbar=s3");
    expect(saveAnswer).not.toHaveBeenCalled();
  });

  it("rejects an unknown intent", async () => {
    await expect(
      action({ request: postRequest([["intent", "other"]]), params }),
    ).rejects.toMatchObject({ init: { status: 400 } });
  });

  it("stores the answer of the universal link under the entered name", async () => {
    const response = await action({ request: postRequest(finish), params });

    expect(saveAnswer).toHaveBeenCalledWith(
      { db: true },
      {
        appointmentId: "a1",
        name: "Guest C",
        participantId: undefined,
        availableSlotIds: ["s1", "s3"],
      },
    );
    expect(locationOf(response)).toBe("/umfrage/t1/naechste-schritte?teilnehmer=p9");
  });

  it("stores the answer of a personal link for its participant and ignores a submitted name", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    await action({ request: postRequest(finish), params });

    expect(saveAnswer).toHaveBeenCalledWith(
      { db: true },
      {
        appointmentId: "a1",
        name: "Guest D",
        participantId: "p1",
        availableSlotIds: ["s1", "s3"],
      },
    );
  });

  it("stores that no window fits", async () => {
    await action({
      request: postRequest([
        ["intent", "finish"],
        ["name", "Guest C"],
        ["keines", "1"],
      ]),
      params,
    });

    expect(saveAnswer).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({ availableSlotIds: [] }),
    );
  });

  it("stores nothing for an invalid answer", async () => {
    const response = await action({
      request: postRequest([
        ["intent", "finish"],
        ["name", "Guest C"],
      ]),
      params,
    });

    expect(saveAnswer).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("/umfrage/t1?name=Guest+C");
  });

  it.each(["closed", "answered", "unavailable"] as const)(
    "goes back to the form when saving fails because the survey is %s",
    async (reason) => {
      vi.mocked(saveAnswer).mockResolvedValue({ saved: false, reason });

      const response = await action({ request: postRequest(finish), params });

      expect(locationOf(response)).toBe("/umfrage/t1?name=Guest+C&verfuegbar=s1&verfuegbar=s3");
    },
  );
});

function renderConfirm(search = query) {
  const Stub = createRoutesStub([
    { path: "/umfrage/:token/zusammenfassung", Component: SurveyConfirm, loader, action },
    { path: "/umfrage/:token", Component: () => <h1>Form page</h1> },
    { path: "/umfrage/:token/naechste-schritte", Component: () => <h1>Result page</h1> },
  ]);
  render(<Stub initialEntries={[`/umfrage/t1/zusammenfassung${search}`]} />);
}

describe("survey confirm page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
    vi.mocked(saveAnswer).mockResolvedValue({ saved: true, participantId: "p9" });
  });

  it("summarises the Aktenzeichen, the name and the windows", async () => {
    renderConfirm();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByText("574 C 65412/26")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ihre Daten" })).toBeVisible();
    expect(screen.getByText("Name")).toBeVisible();
    expect(screen.getByText("Guest C")).toBeVisible();

    const windows = screen.getByRole("heading", { name: "Zeitfenster" }).closest("details")!;
    expect(within(windows).getByText("17. September 2026")).toBeVisible();
    expect(within(windows).getByText("10:00 – verfügbar")).toBeVisible();
    expect(within(windows).getByText("09:00 – nicht verfügbar")).toBeVisible();
    expect(within(windows).getByText("15:30 – verfügbar")).toBeVisible();
  });

  it("lets the guest edit the name and the windows but not the Aktenzeichen", async () => {
    renderConfirm();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "Bearbeiten Ihre Daten" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bearbeiten Zeitfenster" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bearbeiten Verhandlungsdaten" })).toBeNull();
  });

  it("shows the name of a personal link without a way to edit it", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);
    renderConfirm("?verfuegbar=s2");

    expect(await screen.findByText("Guest D")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bearbeiten Ihre Daten" })).toBeNull();
  });

  it("shows every window as unavailable when none fits", async () => {
    renderConfirm("?name=Guest+C&keines=1");

    expect(await screen.findAllByText(/– nicht verfügbar$/)).toHaveLength(3);
    expect(screen.queryByText(/– verfügbar$/)).toBeNull();
  });

  it("goes back to the form", async () => {
    renderConfirm();

    await userEvent.click(await screen.findByRole("button", { name: "Zurück" }));

    expect(await screen.findByRole("heading", { name: "Form page" })).toBeVisible();
  });

  it("stores the answer and shows the result", async () => {
    renderConfirm();

    await userEvent.click(await screen.findByRole("button", { name: "Terminumfrage abschließen" }));

    expect(await screen.findByRole("heading", { name: "Result page" })).toBeVisible();
    expect(saveAnswer).toHaveBeenCalledTimes(1);
  });
});
