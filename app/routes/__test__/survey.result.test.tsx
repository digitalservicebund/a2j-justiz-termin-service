import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findSurvey,
  getSavedAnswer,
  type SavedAnswer,
  type Survey,
} from "~/adapters/appointments/survey.server";

import SurveyResult, { loader } from "../survey.result";

vi.mock("~/adapters/appointments/survey.server", () => ({
  findSurvey: vi.fn(),
  getSavedAnswer: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const url = "http://localhost:3000/umfrage/t1/naechste-schritte";

const survey: Survey = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  answered: false,
  slots: [],
};

// 10:00 and 14:00 Berlin time in September are 08:00 and 12:00 UTC.
const available: SavedAnswer = {
  name: "Guest C",
  available: [
    { id: "s1", start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
    { id: "s3", start: new Date("2026-09-24T12:00:00Z"), end: new Date("2026-09-24T15:00:00Z") },
  ],
};

describe("survey result route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(survey);
    vi.mocked(getSavedAnswer).mockResolvedValue(available);
  });

  it("answers 404 for an unknown or closed survey", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(
      loader({ request: new Request(`${url}?teilnehmer=p1`), params }),
    ).rejects.toMatchObject({ init: { status: 404 } });
    expect(getSavedAnswer).not.toHaveBeenCalled();
  });

  it("groups the windows the participant said yes to", async () => {
    const result = await loader({ request: new Request(`${url}?teilnehmer=p1`), params });

    expect(getSavedAnswer).toHaveBeenCalledWith({ db: true }, "a1", "p1");
    expect(result.days.map(({ label, windows }) => [label, windows.map((w) => w.start)])).toEqual([
      ["17. September 2026", ["10:00"]],
      ["24. September 2026", ["14:00"]],
    ]);
  });

  it("sends visitors without a participant to the form", async () => {
    const thrown = (await loader({ request: new Request(url), params }).catch(
      (error: Response) => error,
    )) as Response;

    expect(thrown.headers.get("Location")).toBe("/umfrage/t1");
    expect(getSavedAnswer).not.toHaveBeenCalled();
  });

  it("sends visitors with an unknown participant or one that has not answered to the form", async () => {
    vi.mocked(getSavedAnswer).mockResolvedValue(undefined);

    const thrown = (await loader({ request: new Request(`${url}?teilnehmer=other`), params }).catch(
      (error: Response) => error,
    )) as Response;

    expect(thrown.status).toBe(302);
    expect(thrown.headers.get("Location")).toBe("/umfrage/t1");
  });
});

function renderResult() {
  const Stub = createRoutesStub([
    { path: "/umfrage/:token/naechste-schritte", Component: SurveyResult, loader },
  ]);
  render(<Stub initialEntries={["/umfrage/t1/naechste-schritte?teilnehmer=p1"]} />);
}

describe("survey result page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(survey);
    vi.mocked(getSavedAnswer).mockResolvedValue(available);
  });

  it("thanks the guest and lists the next steps with the available windows", async () => {
    renderResult();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Danke für das Angeben Ihrer Verfügbarkeiten.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Nächste Schritte" })).toBeVisible();
    // Guests have no overview to go to.
    expect(screen.queryByRole("link", { name: "Zu den Terminumfragen" })).toBeNull();

    const list = screen
      .getByRole("heading", { level: 2, name: "Nächste Schritte" })
      .closest("section")!;
    const steps = within(list)
      .getAllByRole("listitem")
      .filter((item) => item.parentElement?.tagName === "OL");
    expect(steps.map((step) => within(step).getByRole("heading").textContent)).toEqual([
      "Halten Sie sich die angegebenen Zeitfenster frei, bis vom Gericht ein Termin festgelegt wurde.",
      "Alle anderen Verfahrensbeteiligten geben Ihre Verfügbarkeiten an.",
      "Das Gericht legt einen passenden Termin fest.",
      "Sie erhalten die Ladung.",
    ]);
    expect(within(steps[0]!).getByText("17. September 2026")).toBeVisible();
    expect(within(steps[0]!).getByText("10:00")).toBeVisible();
    expect(within(steps[0]!).getByText("24. September 2026")).toBeVisible();
    expect(within(steps[0]!).getByText("14:00")).toBeVisible();
  });

  it("tells the guest that no option works when no window fits", async () => {
    vi.mocked(getSavedAnswer).mockResolvedValue({ name: "Guest C", available: [] });
    renderResult();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Das Gericht wird wahrscheinlich eine neue Terminumfrage erstellen."),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Nächste Schritte" })).toBeNull();
  });
});
