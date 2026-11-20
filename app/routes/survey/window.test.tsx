import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findSurvey, type Survey } from "~/adapters/appointments/survey.server";
import { windowKey } from "~/core/domain/availability";

import SurveyWindow, { action, loader } from "./window";

vi.mock("~/adapters/appointments/survey.server", () => ({ findSurvey: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const params = { token: "t1" };
const base = "http://localhost:3000/umfrage/t1/zeitfenster";

// 14:00 to 17:00 Berlin time on 24 September 2026 is 12:00 to 15:00 UTC.
const window = {
  slotId: "s1",
  start: new Date("2026-09-24T12:00:00Z"),
  end: new Date("2026-09-24T15:00:00Z"),
};
const offerKey = windowKey(window);
const offer = { id: offerKey, ...window };
// 09:00 to 11:00 on 21 September, another offered window.
const other = windowKey({
  slotId: "s2",
  start: new Date("2026-09-21T07:00:00Z"),
  end: new Date("2026-09-21T09:00:00Z"),
});
// 15:30 to 17:00 within the offered window.
const smaller = { slotId: "s1", start: new Date("2026-09-24T13:30:00Z"), end: window.end };
const smallerKey = windowKey(smaller);

const survey: Survey = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  minDurationMinutes: 60,
  answered: false,
  slots: [offer],
  proposedSlots: [],
};

const url = (search: string) => `${base}?${search}`;
const draft = `name=Guest+C&verfuegbar=${other}`;

function postRequest(search: string, fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request(url(search), { method: "POST", body: form });
}

const times = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":");
  const [endHour, endMinute] = end.split(":");
  return {
    startHour: startHour!,
    startMinute: startMinute!,
    endHour: endHour!,
    endMinute: endMinute!,
  };
};

const locationOf = (response: unknown) => (response as Response).headers.get("Location");

describe("survey window route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(survey);
  });

  it("answers 404 for an unknown or closed survey", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(
      loader({ request: new Request(url(`angebot=${offerKey}`)), params }),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("starts a new window as the whole offered one", async () => {
    const result = await loader({
      request: new Request(url(`${draft}&angebot=${offerKey}`)),
      params,
    });

    expect(result).toEqual({
      aktenzeichen: "574 C 65412/26",
      offer: "24. September 2026 von 14:00 bis 17:00",
      fields: times("14:00", "17:00"),
      cancelHref: `/umfrage/t1?${draft}#zeitfenster-${offerKey}`,
      editing: false,
    });
  });

  it("starts a changed window with its own times", async () => {
    const result = await loader({
      request: new Request(
        url(`verfuegbar=${smallerKey}&angebot=${offerKey}&fenster=${smallerKey}`),
      ),
      params,
    });

    expect(result).toMatchObject({ fields: times("15:30", "17:00"), editing: true });
  });

  it("treats a window outside the offered one as a new window", async () => {
    const result = await loader({
      request: new Request(url(`angebot=${offerKey}&fenster=${other}`)),
      params,
    });

    expect(result).toMatchObject({ fields: times("14:00", "17:00"), editing: false });
  });

  it("sends the guest back to the survey when the window is no longer offered", async () => {
    for (const search of [`${draft}&angebot=${other}`, draft]) {
      const thrown = await loader({ request: new Request(url(search)), params }).catch(
        (error: Response) => error,
      );
      expect(locationOf(thrown)).toBe(`/umfrage/t1?${draft}`);
    }
  });

  it("sends a personal link that has answered away", async () => {
    vi.mocked(findSurvey).mockResolvedValue({
      ...survey,
      participant: { id: "p1", name: "Guest D" },
      answered: true,
    });

    const thrown = await loader({
      request: new Request(url(`angebot=${offerKey}`)),
      params,
    }).catch((error: Response) => error);
    expect(locationOf(thrown)).toBe("/umfrage/t1");
  });

  it("adds the window to the draft in place of the tick and goes back to the survey", async () => {
    const response = await action({
      request: postRequest(
        `name=Guest+C&verfuegbar=${offerKey}&angebot=${offerKey}`,
        times("15:30", "17:00"),
      ),
      params,
    });

    expect(locationOf(response)).toBe(
      `/umfrage/t1?name=Guest+C&verfuegbar=${smallerKey}#zeitfenster-${offerKey}`,
    );
  });

  it("merges the window with one it overlaps", async () => {
    const response = await action({
      request: postRequest(`verfuegbar=${smallerKey}&angebot=${offerKey}`, times("15:00", "16:00")),
      params,
    });

    const merged = windowKey({
      slotId: "s1",
      start: new Date("2026-09-24T13:00:00Z"),
      end: window.end,
    });
    expect(locationOf(response)).toBe(`/umfrage/t1?verfuegbar=${merged}#zeitfenster-${offerKey}`);
  });

  it("accepts a short window that becomes long enough with one it touches", async () => {
    // 15:30 to 17:00 is there already; 15:00 to 15:30 alone is shorter than an hour.
    const response = await action({
      request: postRequest(`verfuegbar=${smallerKey}&angebot=${offerKey}`, times("15:00", "15:30")),
      params,
    });

    const merged = windowKey({
      slotId: "s1",
      start: new Date("2026-09-24T13:00:00Z"),
      end: window.end,
    });
    expect(locationOf(response)).toBe(`/umfrage/t1?verfuegbar=${merged}#zeitfenster-${offerKey}`);
  });

  it("does not count a tick of the whole offered window towards the length", async () => {
    const response = await action({
      request: postRequest(`verfuegbar=${offerKey}&angebot=${offerKey}`, times("16:00", "16:30")),
      params,
    });

    expect(response).toMatchObject({ init: { status: 400 } });
  });

  it("does not count the window being changed towards its own length", async () => {
    const response = await action({
      request: postRequest(
        `verfuegbar=${smallerKey}&angebot=${offerKey}&fenster=${smallerKey}`,
        times("16:30", "17:00"),
      ),
      params,
    });

    expect(response).toMatchObject({ init: { status: 400 } });
  });

  it("replaces the window that is changed", async () => {
    const response = await action({
      request: postRequest(
        `verfuegbar=${smallerKey}&angebot=${offerKey}&fenster=${smallerKey}`,
        times("14:00", "15:00"),
      ),
      params,
    });

    const changed = windowKey({
      slotId: "s1",
      start: window.start,
      end: new Date("2026-09-24T13:00:00Z"),
    });
    expect(locationOf(response)).toBe(`/umfrage/t1?verfuegbar=${changed}#zeitfenster-${offerKey}`);
  });

  it("answers 400 with what was entered for a window that does not fit", async () => {
    const tooShort = times("15:30", "16:00");
    expect(
      await action({ request: postRequest(`angebot=${offerKey}`, tooShort), params }),
    ).toMatchObject({
      init: { status: 400 },
      data: {
        fields: tooShort,
        errors: { range: "Das Zeitfenster muss mindestens 60 Minuten lang sein." },
      },
    });

    expect(
      await action({
        request: postRequest(`angebot=${offerKey}`, times("13:00", "15:00")),
        params,
      }),
    ).toMatchObject({
      data: { errors: { range: "Das kleinere Zeitfenster muss zwischen 14:00 und 17:00 liegen." } },
    });
  });
});

function Survey() {
  const { search, hash } = useLocation();
  return (
    <h1>
      Survey page {search} {hash}
    </h1>
  );
}

function renderPage(search: string) {
  const Stub = createRoutesStub([
    { path: "/umfrage/:token/zeitfenster", Component: SurveyWindow, loader, action },
    { path: "/umfrage/:token", Component: Survey },
  ]);
  render(<Stub initialEntries={[`/umfrage/t1/zeitfenster?${search}`]} />);
}

describe("survey window page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSurvey).mockResolvedValue(survey);
  });

  it("shows the offered window and the prefilled times", async () => {
    renderPage(`angebot=${offerKey}`);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Geben Sie ein kleineres Zeitfenster an",
      }),
    ).toBeVisible();
    expect(screen.getByText("Verfügbarkeit")).toBeVisible();
    expect(screen.getByText("574 C 65412/26")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "24. September 2026 von 14:00 bis 17:00" }),
    ).toBeVisible();
    expect(screen.getByRole("group", { name: "Kleineres Zeitfenster" })).toBeVisible();
    const [startHour, startMinute, endHour, endMinute] = screen.getAllByRole("textbox");
    expect(startHour).toHaveValue("14");
    expect(startMinute).toHaveValue("00");
    expect(endHour).toHaveValue("17");
    expect(endMinute).toHaveValue("00");
    expect(screen.getByRole("link", { name: "Abbrechen" })).toHaveAttribute(
      "href",
      `/umfrage/t1#zeitfenster-${offerKey}`,
    );
  });

  it("names the change in the heading", async () => {
    renderPage(`verfuegbar=${smallerKey}&angebot=${offerKey}&fenster=${smallerKey}`);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ändern Sie das kleinere Zeitfenster" }),
    ).toBeVisible();
  });

  it("shows what is wrong and keeps what was entered", async () => {
    renderPage(`angebot=${offerKey}`);

    const [startHour, startMinute] = await screen.findAllByRole("textbox");
    await userEvent.clear(startHour!);
    await userEvent.type(startHour!, "16");
    await userEvent.clear(startMinute!);
    await userEvent.type(startMinute!, "30");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText("Das Zeitfenster muss mindestens 60 Minuten lang sein."),
    ).toBeVisible();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("16");
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("aria-invalid", "true");
  });

  it("saves and goes back to the survey with the window in the draft", async () => {
    renderPage(`name=Guest+C&angebot=${offerKey}`);

    const [startHour, startMinute] = await screen.findAllByRole("textbox");
    await userEvent.clear(startHour!);
    await userEvent.type(startHour!, "15");
    await userEvent.clear(startMinute!);
    await userEvent.type(startMinute!, "30");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByRole("heading", {
        name: `Survey page ?name=Guest+C&verfuegbar=${smallerKey} #zeitfenster-${offerKey}`,
      }),
    ).toBeVisible();
  });
});
