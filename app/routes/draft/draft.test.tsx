import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { wallClockToInstant } from "~/core/domain/time/berlin.server";

import CreateTerminConfirm, { action as confirmAction, loader as confirmLoader } from "./confirm";
import CreateTerminCourt, { action as courtAction, loader as courtLoader } from "./court";
import CreateTermin, { action, loader } from "./draft";
import CreateTerminParticipant, {
  action as participantAction,
  loader as participantLoader,
} from "./participant";
import CreateTerminSlot, { action as slotAction, loader as slotLoader } from "./slot";

type Slot = { id: string; start: Date; end: Date };
type Person = { id: string; email: string | null; safeId: string | null; name: string | null };
type Draft = {
  id: string;
  status: string;
  aktenzeichen: string;
  minDurationMinutes: number | null;
  courtCode: string | null;
  slots: Slot[];
  participants: Person[];
};
type Details = {
  aktenzeichen: string;
  minDurationMinutes: number | null;
  courtCode?: string | null;
};

const drafts = vi.hoisted(() => new Map<string, Draft>());
// The judge's default court, as the fake of the richter adapter keeps it.
const richter = vi.hoisted(() => ({ defaultCourt: null as string | null }));

// A fake of the database adapter: drafts live in a map, so the pages can be exercised end to end.
vi.mock("~/adapters/appointments/appointments.server", () => {
  let counter = 0;
  return {
    createDraftAppointment: vi.fn(async (_db, _userId, { courtCode, ...details }: Details) => {
      drafts.set("abc", {
        id: "abc",
        status: "draft",
        ...details,
        courtCode: courtCode ?? null,
        slots: [],
        participants: [],
      });
      return "abc";
    }),
    updateDraftDetails: vi.fn(
      async (_db, _userId, id: string, { courtCode, ...details }: Details) => {
        const draft = drafts.get(id);
        if (draft) Object.assign(draft, details);
        if (draft && courtCode !== undefined) draft.courtCode = courtCode;
        return Boolean(draft);
      },
    ),
    setDraftCourt: vi.fn(async (_db, _userId, id: string, courtCode: string) => {
      const draft = drafts.get(id);
      if (draft) draft.courtCode = courtCode;
      return Boolean(draft);
    }),
    addDraftSlot: vi.fn(async (_db, _userId, id: string, range: { start: Date; end: Date }) => {
      const draft = drafts.get(id);
      draft?.slots.push({ id: `slot-${(counter += 1)}`, ...range });
      return Boolean(draft);
    }),
    updateDraftSlot: vi.fn(
      async (_db, _userId, id: string, slotId: string, range: { start: Date; end: Date }) => {
        const slot = drafts.get(id)?.slots.find((candidate) => candidate.id === slotId);
        if (slot) Object.assign(slot, range);
        return Boolean(slot);
      },
    ),
    deleteDraftSlot: vi.fn(async (_db, _userId, id: string, slotId: string) => {
      const draft = drafts.get(id);
      const before = draft?.slots.length ?? 0;
      if (draft) draft.slots = draft.slots.filter((slot) => slot.id !== slotId);
      return Boolean(draft) && draft!.slots.length < before;
    }),
    deleteDraftIfEmpty: vi.fn(async (_db, _userId, id: string) => {
      const draft = drafts.get(id);
      if (!draft || draft.aktenzeichen.trim() !== "") return false;
      if (draft.minDurationMinutes !== null) return false;
      if (draft.slots.length > 0 || draft.participants.length > 0) return false;
      drafts.delete(id);
      return true;
    }),
    getAppointment: vi.fn(async (_db, _userId, id: string) => {
      const draft = drafts.get(id);
      return (
        draft && {
          ...draft,
          slots: [...draft.slots].sort((a, b) => a.start.getTime() - b.start.getTime()),
        }
      );
    }),
    nextCalendarSequence: vi.fn(async () => 1),
    publishAppointment: vi.fn(async () => true),
  };
});
vi.mock("~/adapters/appointments/participants.server", () => {
  let counter = 0;
  return {
    listParticipants: vi.fn(async (_db, _userId, id: string) => drafts.get(id)?.participants ?? []),
    addDraftParticipant: vi.fn(async (_db, _userId, id: string, person: Omit<Person, "id">) => {
      const draft = drafts.get(id);
      draft?.participants.push({ id: `person-${(counter += 1)}`, ...person });
      return Boolean(draft);
    }),
    updateDraftParticipant: vi.fn(
      async (_db, _userId, id: string, personId: string, person: Omit<Person, "id">) => {
        const found = drafts.get(id)?.participants.find((candidate) => candidate.id === personId);
        if (found) Object.assign(found, person);
        return Boolean(found);
      },
    ),
    deleteDraftParticipant: vi.fn(async (_db, _userId, id: string, personId: string) => {
      const draft = drafts.get(id);
      const before = draft?.participants.length ?? 0;
      if (draft) draft.participants = draft.participants.filter((p) => p.id !== personId);
      return Boolean(draft) && draft!.participants.length < before;
    }),
  };
});
vi.mock("~/adapters/users/richter.server", () => ({
  getDefaultCourt: vi.fn(async () => richter.defaultCourt),
  setDefaultCourt: vi.fn(async (_db, _userId, courtCode: string | null) => {
    richter.defaultCourt = courtCode;
  }),
}));
vi.mock("~/lib/email/send-termin-created-email", () => ({ sendTerminCreatedEmail: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({}) }));
vi.mock("~/adapters/session/session", () => ({
  requireRole: vi.fn().mockResolvedValue({
    id: "1",
    name: "Judge A",
    email: "judge.a@example.com",
    roles: ["richter"],
  }),
}));

// Far in the future, so the "no past dates" rule never trips these tests.
const at = (day: number, hour: number, minute = 0) =>
  wallClockToInstant({ year: 2099, month: 1, day, hour, minute });

function addSlot(day: number, hour: number, endHour: number) {
  drafts.get("abc")!.slots.push({
    id: `seed-${day}-${hour}`,
    start: at(day, hour),
    end: at(day, endHour),
  });
}

function seedDraft(
  aktenzeichen = "574 C 65412/26",
  slots: Array<[number, number, number]> = [],
  participants: Person[] = [],
  // No seeded slot is shorter than an hour.
  minDurationMinutes: number | null = 60,
  courtCode: string | null = "B2402",
) {
  // Copies, so that a test that edits a person cannot change the fixture for the next one.
  const copies = participants.map((person) => ({ ...person }));
  drafts.set("abc", {
    id: "abc",
    status: "draft",
    aktenzeichen,
    minDurationMinutes,
    courtCode,
    slots: [],
    participants: copies,
  });
  for (const [day, hour, endHour] of slots) addSlot(day, hour, endHour);
}

beforeEach(() => {
  drafts.clear();
  richter.defaultCourt = null;
  vi.clearAllMocks();
});

function renderPage(entry = "/overview/new") {
  const Stub = createRoutesStub([
    { path: "/overview/new", Component: CreateTermin, action, loader },
    {
      path: "/overview/:appointmentId/zeitfenster/:slotId",
      Component: CreateTerminSlot,
      action: slotAction,
      loader: slotLoader,
    },
    {
      path: "/overview/:appointmentId/verfahrensbeteiligte/:participantId",
      Component: CreateTerminParticipant,
      action: participantAction,
      loader: participantLoader,
    },
    {
      path: "/overview/:appointmentId/gericht",
      Component: CreateTerminCourt,
      action: courtAction,
      loader: courtLoader,
    },
    {
      path: "/overview/:appointmentId/confirm",
      Component: CreateTerminConfirm,
      action: confirmAction,
      loader: confirmLoader,
    },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
  ]);
  return render(<Stub initialEntries={[entry]} />);
}

const MIN_DURATION = "Mindestdauer der Verhandlung in Minuten";
const user = () => userEvent.setup();

async function fillSlot(day: string, start: [string, string], end: [string, string]) {
  const typist = user();
  const type = async (group: string, label: string, value: string) => {
    const field = within(screen.getByRole("group", { name: group })).getByRole("textbox", {
      name: label,
    });
    await typist.clear(field);
    await typist.type(field, value);
  };
  await type("Datum", "Tag", day);
  await type("Datum", "Monat", "1");
  await type("Datum", "Jahr", "2099");
  await type("Beginn", "Stunde", start[0]);
  await type("Beginn", "Minute", start[1]);
  await type("Ende", "Stunde", end[0]);
  await type("Ende", "Minute", end[1]);
}

const tableRows = (name: string) =>
  within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);
const rows = () => tableRows("Zeitfenster");
const personRows = () => tableRows("Verfahrensbeteiligte");

describe("CreateTermin form", () => {
  it("starts with the Aktenzeichen, empty tables and buttons to add a person and a slot", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Geben Sie die Verhandlungsdaten an" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("");
    const minDuration = screen.getByRole("textbox", { name: MIN_DURATION });
    expect(minDuration).toHaveValue("");
    expect(minDuration).toHaveAccessibleDescription(
      "Zum Beispiel 15, 30, 60, 90 oder 120. Kein Zeitfenster darf kürzer sein.",
    );
    expect(
      screen.getByRole("heading", { name: "Geben Sie alle Verfahrensbeteiligten an" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Zeitfenster" })).toBeInTheDocument();
    expect(personRows().map((row) => row.textContent)).toEqual([
      "Sie haben keine Verfahrensbeteiligten angegeben.",
    ]);
    expect(rows().map((row) => row.textContent)).toEqual([
      "Sie haben keine Zeitfenster angegeben.",
    ]);
    for (const name of ["Verfahrensbeteiligte", "Zeitfenster"]) {
      const table = screen.getByRole("table", { name });
      const [emptyCell] = within(tableRows(name)[0]).getAllByRole("cell");
      expect(emptyCell).toHaveAttribute(
        "colspan",
        String(within(table).getAllByRole("columnheader").length),
      );
    }
    expect(screen.getByRole("button", { name: "Person hinzufügen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Zeitfenster hinzufügen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
  });

  it("lists the saved time slots with edit, copy and delete actions", async () => {
    seedDraft("A 1", [
      [6, 9, 11],
      [5, 10, 14],
    ]);
    renderPage("/overview/new?entwurf=abc");

    await screen.findByRole("table", { name: "Zeitfenster" });
    expect(screen.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("A 1");
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("5. Januar 209910:00 bis 14:00"),
      expect.stringContaining("6. Januar 209909:00 bis 11:00"),
    ]);
    const first = within(rows()[0]!);
    for (const verb of ["bearbeiten", "kopieren", "löschen"]) {
      expect(
        first.getByRole("button", { name: `Zeitfenster 5. Januar 2099, 10:00 bis 14:00 ${verb}` }),
      ).toBeInTheDocument();
    }
  });
});

describe("CreateTermin participants", () => {
  const personA = { id: "a", email: "person.a@example.com", safeId: null, name: null };
  const personB = { id: "b", email: null, safeId: null, name: "Person B" };
  const personC = { id: "c", email: null, safeId: "DE.Example.c1", name: null };

  it("lists the people with their address, SAFE-ID and name, and edit and delete actions", async () => {
    seedDraft("A 1", [], [personA, personB, personC]);
    renderPage("/overview/new?entwurf=abc");

    const table = await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["E-Mail-Adresse", "SAFE-ID", "Name", "Aktionen"]);
    expect(personRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("person.a@example.com"),
      expect.stringContaining("Person B"),
      expect.stringContaining("DE.Example.c1"),
    ]);
    expect(
      within(personRows()[2]!).getByRole("button", { name: "Person DE.Example.c1 bearbeiten" }),
    ).toBeEnabled();
    const first = within(personRows()[0]!);
    expect(
      first.getByRole("button", { name: "Person person.a@example.com bearbeiten" }),
    ).toBeEnabled();
    expect(
      first.getByRole("button", { name: "Person person.a@example.com löschen" }),
    ).toBeEnabled();
    expect(first.queryByRole("button", { name: /kopieren/ })).not.toBeInTheDocument();
    expect(
      within(personRows()[1]!).getByRole("button", { name: "Person Person B bearbeiten" }),
    ).toBeEnabled();
  });

  it("goes back from the page of a person without saving", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/verfahrensbeteiligte/neu");
    await user().type(
      await screen.findByRole("textbox", { name: /^E-Mail-Adresse/ }),
      "a@example.com",
    );

    await user().click(screen.getByRole("link", { name: "Abbrechen" }));

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("A 1");
    expect(drafts.get("abc")!.participants).toHaveLength(0);
  });

  it("continues to the review without any person", async () => {
    seedDraft("A 1", [
      [5, 9, 10],
      [6, 9, 10],
    ]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Weiter" }));

    expect(
      await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeInTheDocument();
    const section = screen.getByRole("group", { name: "Verfahrensbeteiligte" });
    expect(
      within(section).getByText("Sie haben keine Verfahrensbeteiligten angegeben."),
    ).toBeVisible();
  });

  it("lists the people in the review", async () => {
    seedDraft(
      "A 1",
      [
        [5, 9, 10],
        [6, 9, 10],
      ],
      [{ ...personA, name: "Person A" }, personB, { ...personC, email: "person.c@example.com" }],
    );
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Weiter" }));

    const section = await screen.findByRole("group", { name: "Verfahrensbeteiligte" });
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "person.a@example.com, Person A",
      "Person B",
      "person.c@example.com, SAFE-ID: DE.Example.c1",
    ]);
  });

  it("keeps a draft that only has a person when cancelling", async () => {
    seedDraft("", [], [personA]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Abbrechen" }));

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    expect(drafts.has("abc")).toBe(true);
  });
});

describe("CreateTermin court", () => {
  it("starts a new Terminumfrage with the default court and a button to change it", async () => {
    richter.defaultCourt = "B2402";
    renderPage();

    expect(await screen.findByText("Amtsgericht Biberach an der Riß")).toBeVisible();
    expect(screen.getByText("Gericht")).toBeVisible();
    expect(screen.getByRole("button", { name: "Gericht ändern" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Gericht" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("asks for a court with the list when the judge has no default court", async () => {
    renderPage();

    const select = await screen.findByRole("combobox", { name: "Gericht" });
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: "Als mein Standardgericht speichern" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Gericht ändern" })).not.toBeInTheDocument();
  });

  it("saves the picked court with the draft, and as the default when asked", async () => {
    renderPage();
    const typist = user();

    await typist.selectOptions(await screen.findByRole("combobox", { name: "Gericht" }), "D2000");
    await typist.click(
      screen.getByRole("checkbox", { name: "Als mein Standardgericht speichern" }),
    );
    await typist.click(screen.getByRole("button", { name: "Person hinzufügen" }));
    await screen.findByRole("heading", { name: "Wie erreichen Sie die Person?" });

    expect(drafts.get("abc")?.courtCode).toBe("D2000");
    expect(richter.defaultCourt).toBe("D2000");
  });

  it("changes the court of one Terminumfrage on its own page and keeps the default", async () => {
    richter.defaultCourt = "B2402";
    seedDraft("A 1");
    renderPage("/overview/new?entwurf=abc");
    const typist = user();

    await typist.click(await screen.findByRole("button", { name: "Gericht ändern" }));
    const select = await screen.findByRole("combobox", { name: "Gericht" });
    expect(select).toHaveValue("B2402");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await typist.selectOptions(select, "D2000");
    await typist.click(screen.getByRole("button", { name: "Speichern" }));

    // The option of the dropdown has the same text, so the test waits for the form first.
    await screen.findByRole("heading", { name: "Geben Sie die Verhandlungsdaten an" });
    expect(screen.getByText("Oberlandesgericht München")).toBeVisible();
    expect(drafts.get("abc")?.courtCode).toBe("D2000");
    expect(richter.defaultCourt).toBe("B2402");
  });

  it("goes back from the page of the court without saving", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/gericht");
    const typist = user();

    await typist.selectOptions(await screen.findByRole("combobox", { name: "Gericht" }), "D2000");
    await typist.click(screen.getByRole("link", { name: "Abbrechen" }));

    await screen.findByRole("heading", { name: "Geben Sie die Verhandlungsdaten an" });
    expect(screen.getByText("Amtsgericht Biberach an der Riß")).toBeVisible();
    expect(drafts.get("abc")?.courtCode).toBe("B2402");
  });

  it("asks for a court on its page when none is picked", async () => {
    seedDraft("A 1", [], [], 60, null);
    renderPage("/overview/abc/gericht");
    const typist = user();

    await typist.click(await screen.findByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("combobox", { name: "Gericht" })).toHaveAccessibleDescription(
      "Wählen Sie ein Gericht aus.",
    );
  });

  it("names the court in the review", async () => {
    seedDraft("A 1", [
      [5, 9, 10],
      [6, 9, 10],
    ]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Weiter" }));

    const section = await screen.findByRole("group", { name: "Verhandlungsdaten" });
    expect(within(section).getByText("Gericht")).toBeVisible();
    expect(within(section).getByText("Amtsgericht Biberach an der Riß")).toBeVisible();
  });
});

describe("CreateTermin slot page", () => {
  it("accepts a slot of any length while the draft has no minimum duration", async () => {
    seedDraft("A 1", [], [], null);
    renderPage("/overview/abc/zeitfenster/neu");
    await screen.findByRole("group", { name: "Datum" });
    expect(screen.queryByText(/Mindestdauer/)).not.toBeInTheDocument();

    await fillSlot("5", ["9", "0"], ["9", "1"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByRole("table", { name: "Zeitfenster" });
    expect(drafts.get("abc")!.slots).toHaveLength(1);
  });

  it("shows a missing slot as not found", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/zeitfenster/nope");

    expect(await screen.findByText("Unexpected Application Error!")).toBeInTheDocument();
  });
});

async function reviewStep() {
  seedDraft("574 C 65412/26", [
    [5, 9, 10],
    [6, 9, 10],
  ]);
  renderPage("/overview/new?entwurf=abc");
  await user().click(await screen.findByRole("button", { name: "Weiter" }));
  await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" });
}

const sections = () => [...document.querySelectorAll("details")];

describe("CreateTermin review step", () => {
  it("collapses and expands every section at once", async () => {
    await reviewStep();
    expect(sections().every((element) => element.open)).toBe(true);

    await user().click(screen.getByRole("button", { name: "Alle ausblenden" }));
    expect(sections().every((element) => !element.open)).toBe(true);

    await user().click(screen.getByRole("button", { name: "Alle einblenden" }));
    expect(sections().every((element) => element.open)).toBe(true);
  });

  it.each(["Zurück", "Bearbeiten Verhandlungsdaten", "Bearbeiten Zeitfenster"])(
    "%s returns to the form with the saved draft",
    async (name) => {
      await reviewStep();

      await user().click(screen.getByRole("button", { name }));

      expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue(
        "574 C 65412/26",
      );
      expect(rows()).toHaveLength(2);
    },
  );
});
