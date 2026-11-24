import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import {
  findSurvey,
  issueResponseOverview,
  saveAnswer,
  type Survey,
} from "~/adapters/appointments/survey.server";
import { windowKey, type ResponseOverview } from "~/core/domain/availability";
import { sendAnswerReceivedEmail } from "~/lib/email/send-answer-received-email";

import SurveyConfirm, { action, loader } from "./confirm";

vi.mock("~/adapters/appointments/survey.server", () => ({
  findSurvey: vi.fn(),
  issueResponseOverview: vi.fn(),
  saveAnswer: vi.fn(),
}));
vi.mock("~/lib/email/send-answer-received-email", () => ({ sendAnswerReceivedEmail: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const url = "http://localhost:3000/umfrage/t1/zusammenfassung";

// A window as the survey offers it: its id is the window key, which the form submits.
const offer = (slotId: string, start: string, end: string) => {
  const window = { slotId, start: new Date(start), end: new Date(end) };
  return { id: windowKey(window), ...window };
};
const w1 = offer("s1", "2026-09-17T08:00:00Z", "2026-09-17T12:00:00Z");
const w2 = offer("s2", "2026-09-21T07:00:00Z", "2026-09-21T09:00:00Z");
const w3 = offer("s3", "2026-09-21T13:30:00Z", "2026-09-21T15:00:00Z");
const [k1, k2, k3] = [w1.id, w2.id, w3.id];
const range = ({ slotId, start, end }: typeof w1) => ({ slotId, start, end });
const query = `?name=Guest+C&verfuegbar=${k1}&verfuegbar=${k3}`;

// 10:00 to 14:00, 09:00 to 11:00 and 15:30 to 17:00 Berlin time in September are 08:00 to 12:00,
// 07:00 to 09:00 and 13:30 to 15:00 UTC.
const universal: Survey = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  answered: false,
  minDurationMinutes: null,
  slots: [w1, w2, w3],
  proposedSlots: [],
};

const personal: Survey = { ...universal, participant: { id: "p1", name: "Guest D" } };

const overview: ResponseOverview = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  judgeEmail: "judge.a@example.com",
  calendarSequence: 1,
  slots: [],
};

function postRequest(fields: Array<[string, string]>) {
  const form = new FormData();
  for (const [key, value] of fields) form.append(key, value);
  return new Request(url, { method: "POST", body: form });
}

const finish: Array<[string, string]> = [
  ["intent", "finish"],
  ["name", "Guest C"],
  ["verfuegbar", k1],
  ["verfuegbar", k3],
];

describe("survey confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(universal);
    vi.mocked(saveAnswer).mockResolvedValue({ saved: true, participantId: "p9" });
    vi.mocked(issueResponseOverview).mockResolvedValue(overview);
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
      values: { name: "Guest C", available: [k1, k3], none: false },
      answers: [
        { label: "17. September 2026", lines: ["10:00 bis 14:00 – verfügbar"] },
        {
          label: "21. September 2026",
          lines: ["09:00 bis 11:00 – nicht verfügbar", "15:30 bis 17:00 – verfügbar"],
        },
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
      "10:00 bis 14:00 – nicht verfügbar",
      "09:00 bis 11:00 – nicht verfügbar",
      "15:30 bis 17:00 – nicht verfügbar",
    ]);
  });

  it("names the guest of a personal link without asking", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);

    const result = await loader({ request: new Request(`${url}?verfuegbar=${k2}`), params });

    expect(result).toMatchObject({ name: "Guest D", needsName: false });
  });

  it("sends the guest to the form, which says sorry, when no window is left", async () => {
    vi.mocked(findSurvey).mockResolvedValue({ ...universal, slots: [] });

    const thrown = await callLoader(loader, {
      request: new Request(`${url}?name=Guest+C&keines=1`),
      params,
    });
    expect(thrown).toMatchObject({ thrown: true, location: "/umfrage/t1" });

    const response = await callAction(action, { request: postRequest(finish), params });
    expect(response.location).toBe("/umfrage/t1");
    expect(saveAnswer).not.toHaveBeenCalled();
  });

  it("sends an invalid answer back to the form", async () => {
    for (const search of [
      "",
      `?verfuegbar=${k1}`,
      "?name=Guest+C",
      `?name=Guest+C&verfuegbar=${k1}&keines=1`,
      "?name=Guest+C&verfuegbar=hidden",
    ]) {
      const thrown = await callLoader(loader, { request: new Request(url + search), params });
      expect(thrown).toMatchObject({ thrown: true, status: 302 });
      expect(thrown.location).toMatch(/^\/umfrage\/t1\?/);
    }
  });

  it("goes back to the form with the answer", async () => {
    const response = await callAction(action, {
      request: postRequest([["intent", "back"], ...finish.slice(1)]),
      params,
    });

    expect(response.location).toBe(`/umfrage/t1?name=Guest+C&verfuegbar=${k1}&verfuegbar=${k3}`);
    expect(saveAnswer).not.toHaveBeenCalled();
  });

  it("rejects an unknown intent", async () => {
    await expect(
      action({ request: postRequest([["intent", "other"]]), params }),
    ).rejects.toMatchObject({ init: { status: 400 } });
  });

  it("stores the answer of the universal link under the entered name", async () => {
    const response = await callAction(action, { request: postRequest(finish), params });

    expect(saveAnswer).toHaveBeenCalledWith(
      { db: true },
      {
        appointmentId: "a1",
        name: "Guest C",
        participantId: undefined,
        availability: [range(w1), range(w3)],
      },
    );
    expect(response.location).toBe("/umfrage/t1/naechste-schritte?teilnehmer=p9");
  });

  it("tells the judge about the answer after it is stored, under the entered name", async () => {
    await action({ request: postRequest(finish), params });

    expect(issueResponseOverview).toHaveBeenCalledWith({ db: true }, "a1");
    expect(sendAnswerReceivedEmail).toHaveBeenCalledWith(overview, { id: "p9", name: "Guest C" });
  });

  it("names the guest of a personal link in the e-mail to the judge", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);
    vi.mocked(saveAnswer).mockResolvedValue({ saved: true, participantId: "p1" });

    await action({ request: postRequest(finish), params });

    expect(sendAnswerReceivedEmail).toHaveBeenCalledWith(overview, { id: "p1", name: "Guest D" });
  });

  it("sends nothing when the appointment is gone after saving", async () => {
    vi.mocked(issueResponseOverview).mockResolvedValue(undefined);

    const response = await callAction(action, { request: postRequest(finish), params });

    expect(sendAnswerReceivedEmail).not.toHaveBeenCalled();
    expect(response.location).toBe("/umfrage/t1/naechste-schritte?teilnehmer=p9");
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
        availability: [range(w1), range(w3)],
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
      expect.objectContaining({ availability: [] }),
    );
  });

  it("stores nothing for an invalid answer", async () => {
    const response = await callAction(action, {
      request: postRequest([
        ["intent", "finish"],
        ["name", "Guest C"],
      ]),
      params,
    });

    expect(saveAnswer).not.toHaveBeenCalled();
    expect(sendAnswerReceivedEmail).not.toHaveBeenCalled();
    expect(response.location).toBe("/umfrage/t1?name=Guest+C");
  });

  it.each(["closed", "answered", "unavailable"] as const)(
    "goes back to the form when saving fails because the survey is %s",
    async (reason) => {
      vi.mocked(saveAnswer).mockResolvedValue({ saved: false, reason });

      const response = await callAction(action, { request: postRequest(finish), params });

      expect(response.location).toBe(`/umfrage/t1?name=Guest+C&verfuegbar=${k1}&verfuegbar=${k3}`);
      expect(sendAnswerReceivedEmail).not.toHaveBeenCalled();
    },
  );
});

function renderConfirm(search = query) {
  const Stub = createRoutesStub([
    { path: "/umfrage/:token/zusammenfassung", Component: SurveyConfirm, loader, action },
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
    expect(within(windows).getByText("10:00 bis 14:00 – verfügbar")).toBeVisible();
    expect(within(windows).getByText("09:00 bis 11:00 – nicht verfügbar")).toBeVisible();
    expect(within(windows).getByText("15:30 bis 17:00 – verfügbar")).toBeVisible();
  });

  it("lets the guest edit the name and the windows but not the Aktenzeichen", async () => {
    renderConfirm();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "Bearbeiten Ihre Daten" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bearbeiten Zeitfenster" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bearbeiten Verhandlungsdaten" })).toBeNull();
  });

  it("leaves out the name section for a personal link, which the guest cannot change", async () => {
    vi.mocked(findSurvey).mockResolvedValue(personal);
    renderConfirm(`?verfuegbar=${k2}`);

    expect(await screen.findByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Ihre Daten" })).toBeNull();
    expect(screen.queryByText("Guest D")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bearbeiten Ihre Daten" })).toBeNull();
  });

  it("shows every window as unavailable when none fits", async () => {
    renderConfirm("?name=Guest+C&keines=1");

    expect(await screen.findAllByText(/– nicht verfügbar$/)).toHaveLength(3);
    expect(screen.queryByText(/– verfügbar$/)).toBeNull();
  });
});
