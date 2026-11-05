import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import {
  createRoutesStub,
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type StaticHandlerContext,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishAppointment } from "~/adapters/appointments/appointments.server";
import { wallClockToInstant } from "~/core/domain/time/berlin.server";

import CreateTermin, { action, loader } from "../create-termin";
import CreateTerminConfirm, {
  action as confirmAction,
  loader as confirmLoader,
} from "../create-termin.confirm";
import CreateTerminParticipant, {
  action as participantAction,
  loader as participantLoader,
} from "../create-termin.participant";
import { MAX_PARTICIPANTS } from "../create-termin.participant.schema";
import { ReviewPage } from "../create-termin.review";
import { MAX_SLOTS } from "../create-termin.schema";
import CreateTerminSlot, {
  action as slotAction,
  loader as slotLoader,
} from "../create-termin.slot";

type Slot = { id: string; start: Date; end: Date };
type Person = { id: string; email: string | null; name: string | null };
type Draft = {
  id: string;
  status: string;
  aktenzeichen: string;
  slots: Slot[];
  participants: Person[];
};

const drafts = vi.hoisted(() => new Map<string, Draft>());

// A fake of the database adapter: drafts live in a map, so the pages can be exercised end to end.
vi.mock("~/adapters/appointments/appointments.server", () => {
  let counter = 0;
  return {
    createDraftAppointment: vi.fn(async (_db, _userId, aktenzeichen: string) => {
      drafts.set("abc", { id: "abc", status: "draft", aktenzeichen, slots: [], participants: [] });
      return "abc";
    }),
    updateDraftAktenzeichen: vi.fn(async (_db, _userId, id: string, aktenzeichen: string) => {
      const draft = drafts.get(id);
      if (draft) draft.aktenzeichen = aktenzeichen;
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
) {
  // Copies, so that a test that edits a person cannot change the fixture for the next one.
  const copies = participants.map((person) => ({ ...person }));
  drafts.set("abc", { id: "abc", status: "draft", aktenzeichen, slots: [], participants: copies });
  for (const [day, hour, endHour] of slots) addSlot(day, hour, endHour);
}

beforeEach(() => {
  drafts.clear();
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
      path: "/overview/:appointmentId/confirm",
      Component: CreateTerminConfirm,
      action: confirmAction,
      loader: confirmLoader,
    },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
    {
      path: "/overview/:appointmentId/created",
      Component: () => <h1>Sie haben die Terminumfrage erstellt.</h1>,
    },
  ]);
  return render(<Stub initialEntries={[entry]} />);
}

const TOO_FEW = "Geben Sie mindestens zwei Zeitfenster an.";
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

  it("keeps what was typed when going to the slot page and back", async () => {
    renderPage();
    await user().type(await screen.findByRole("textbox", { name: "Aktenzeichen" }), "574 C 1/26");

    await user().click(screen.getByRole("button", { name: "Zeitfenster hinzufügen" }));
    await screen.findByRole("heading", { name: "Geben Sie Ihr verfügbares Zeitfenster an" });
    await fillSlot("5", ["9", "0"], ["10", "30"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 1/26");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]!).getByText("09:00 bis 10:30")).toBeInTheDocument();
  });

  it("opens a slot for editing with its values and replaces it", async () => {
    seedDraft("A 1", [[5, 9, 10]]);
    renderPage("/overview/new?entwurf=abc");
    await user().click(
      await screen.findByRole("button", {
        name: "Zeitfenster 5. Januar 2099, 09:00 bis 10:00 bearbeiten",
      }),
    );

    const date = await screen.findByRole("group", { name: "Datum" });
    expect(within(date).getByRole("textbox", { name: "Tag" })).toHaveValue("05");
    await fillSlot("7", ["13", "0"], ["14", "0"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByRole("table", { name: "Zeitfenster" });
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]!).getByText("7. Januar 2099")).toBeInTheDocument();
  });

  it("copies a slot into a new one that starts with the same values", async () => {
    seedDraft("A 1", [[5, 9, 10]]);
    renderPage("/overview/new?entwurf=abc");
    await user().click(
      await screen.findByRole("button", {
        name: "Zeitfenster 5. Januar 2099, 09:00 bis 10:00 kopieren",
      }),
    );

    expect(
      within(await screen.findByRole("group", { name: "Datum" })).getByRole("textbox", {
        name: "Tag",
      }),
    ).toHaveValue("05");
    await fillSlot("6", ["9", "0"], ["10", "0"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByRole("table", { name: "Zeitfenster" });
    expect(rows()).toHaveLength(2);
  });

  it("deletes a slot without asking for the others again", async () => {
    seedDraft("A 1", [
      [5, 9, 10],
      [6, 9, 10],
    ]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(
      await screen.findByRole("button", {
        name: "Zeitfenster 5. Januar 2099, 09:00 bis 10:00 löschen",
      }),
    );

    await screen.findByRole("textbox", { name: "Aktenzeichen" });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("6. Januar 2099")).toBeInTheDocument();
  });

  it("shows what is missing and keeps what was typed when continuing too early", async () => {
    seedDraft("", [[5, 9, 10]]);
    renderPage("/overview/new?entwurf=abc");
    await user().type(await screen.findByRole("textbox", { name: "Aktenzeichen" }), "  ");

    await user().click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByText("Geben Sie ein Aktenzeichen an.")).toBeInTheDocument();
    await user().type(screen.getByRole("textbox", { name: "Aktenzeichen" }), "A 1");
    await user().click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByText(TOO_FEW)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("  A 1");
  });

  it("submits 'Weiter', not a slot button, when Enter is pressed in the Aktenzeichen", async () => {
    seedDraft("A 1", [
      [5, 9, 10],
      [6, 9, 10],
    ]);
    renderPage("/overview/new?entwurf=abc");

    await user().type(await screen.findByRole("textbox", { name: "Aktenzeichen" }), "{Enter}");

    expect(
      await screen.findByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeInTheDocument();
    expect(drafts.get("abc")!.slots).toHaveLength(2);
  });

  it("stops offering new slots at the maximum", async () => {
    seedDraft(
      "A 1",
      Array.from(
        { length: MAX_SLOTS },
        (_, index) => [index + 1, 9, 10] as [number, number, number],
      ),
    );
    renderPage("/overview/new?entwurf=abc");

    expect(await screen.findByRole("button", { name: "Zeitfenster hinzufügen" })).toBeDisabled();
    expect(
      screen.getByText(`Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`),
    ).toBeVisible();
  });

  it("removes a draft that is still empty when cancelling, and keeps one with content", async () => {
    renderPage();
    await user().click(await screen.findByRole("button", { name: "Zeitfenster hinzufügen" }));
    await screen.findByRole("group", { name: "Datum" });
    await user().click(screen.getByRole("link", { name: "Abbrechen" }));
    await screen.findByRole("button", { name: "Abbrechen" });
    expect(drafts.get("abc")).toBeDefined();

    await user().click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    expect(drafts.has("abc")).toBe(false);
  });

  it("keeps a draft with an Aktenzeichen when cancelling", async () => {
    seedDraft("A 1");
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Abbrechen" }));

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    expect(drafts.has("abc")).toBe(true);
  });
});

async function addPerson(email: string, name = "") {
  const typist = user();
  await typist.click(await screen.findByRole("button", { name: "Person hinzufügen" }));
  await screen.findByRole("heading", { name: "Wie lautet die E-Mail-Adresse der Person?" });
  if (email) await typist.type(screen.getByRole("textbox", { name: "E-Mail-Adresse" }), email);
  if (name) await typist.type(screen.getByRole("textbox", { name: /^Name/ }), name);
  await typist.click(screen.getByRole("button", { name: "Speichern" }));
}

describe("CreateTermin participants", () => {
  const personA = { id: "a", email: "person.a@example.com", name: null };
  const personB = { id: "b", email: null, name: "Person B" };

  it("lists the people with their address and name, and edit and delete actions", async () => {
    seedDraft("A 1", [], [personA, personB]);
    renderPage("/overview/new?entwurf=abc");

    await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    expect(personRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("person.a@example.com"),
      expect.stringContaining("Person B"),
    ]);
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

  it("adds a person on a page of its own and keeps the typed Aktenzeichen", async () => {
    renderPage();
    await user().type(await screen.findByRole("textbox", { name: "Aktenzeichen" }), "574 C 1/26");

    await addPerson("Person.C@example.com", "Person C");

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 1/26");
    expect(personRows()).toHaveLength(1);
    expect(within(personRows()[0]!).getByText("person.c@example.com")).toBeInTheDocument();
    expect(within(personRows()[0]!).getByText("Person C")).toBeInTheDocument();
  });

  it("adds a person who only has a name", async () => {
    seedDraft("A 1");
    renderPage("/overview/new?entwurf=abc");

    await addPerson("", "Person C");

    await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    expect(personRows().map((row) => row.textContent)).toEqual(["Person C"]);
  });

  it("lets several people share an address and a name", async () => {
    seedDraft("A 1", [], [personA]);
    renderPage("/overview/new?entwurf=abc");

    await addPerson("person.a@example.com", "Person A");
    await addPerson("person.a@example.com", "Person A");

    await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    expect(personRows()).toHaveLength(3);
  });

  it("explains a missing address in place and keeps what was typed", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/verfahrensbeteiligte/neu");
    await screen.findByRole("heading", { name: "Wie lautet die E-Mail-Adresse der Person?" });

    await user().click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Geben Sie eine E-Mail-Adresse an.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "E-Mail-Adresse" })).toBeInvalid();
    expect(drafts.get("abc")!.participants).toHaveLength(0);

    await user().type(screen.getByRole("textbox", { name: "E-Mail-Adresse" }), "nope");
    await user().click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Geben Sie eine gültige E-Mail-Adresse an.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue("nope");
  });

  it("describes the name field and marks it as optional", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/verfahrensbeteiligte/neu");

    const name = await screen.findByRole("textbox", { name: /^Name/ });
    expect(name).toHaveAccessibleName("Name - Optional");
    expect(name).toHaveAccessibleDescription(/keine persönliche E-Mail-Adresse/);
  });

  it("opens a person for editing with the saved values and replaces them", async () => {
    seedDraft("A 1", [], [personA]);
    renderPage("/overview/new?entwurf=abc");
    await user().click(
      await screen.findByRole("button", { name: "Person person.a@example.com bearbeiten" }),
    );

    const email = await screen.findByRole("textbox", { name: "E-Mail-Adresse" });
    expect(email).toHaveValue("person.a@example.com");
    await user().clear(email);
    await user().type(email, "person.d@example.com");
    await user().type(screen.getByRole("textbox", { name: /^Name/ }), "Person D");
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByRole("table", { name: "Verfahrensbeteiligte" });
    expect(personRows()).toHaveLength(1);
    expect(personRows()[0]!.textContent).toContain("person.d@example.com");
    expect(personRows()[0]!.textContent).toContain("Person D");
  });

  it("deletes a person at once, down to the empty state", async () => {
    seedDraft("A 1", [], [personA]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(
      await screen.findByRole("button", { name: "Person person.a@example.com löschen" }),
    );

    expect(
      await screen.findByText("Sie haben keine Verfahrensbeteiligten angegeben."),
    ).toBeVisible();
    expect(drafts.get("abc")!.participants).toHaveLength(0);
  });

  it("goes back from the page of a person without saving", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/verfahrensbeteiligte/neu");
    await user().type(
      await screen.findByRole("textbox", { name: "E-Mail-Adresse" }),
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
      [{ ...personA, name: "Person A" }, personB],
    );
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Weiter" }));

    const section = await screen.findByRole("group", { name: "Verfahrensbeteiligte" });
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["person.a@example.com, Person A", "Person B"]);
  });

  it("stops offering new people at the maximum", async () => {
    seedDraft(
      "A 1",
      [],
      Array.from({ length: MAX_PARTICIPANTS }, (_, index) => ({
        id: `p${index}`,
        email: `person.${index}@example.com`,
        name: null,
      })),
    );
    renderPage("/overview/new?entwurf=abc");

    expect(await screen.findByRole("button", { name: "Person hinzufügen" })).toBeDisabled();
    expect(
      screen.getByText(`Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`),
    ).toBeVisible();
  });

  it("keeps a draft that only has a person when cancelling", async () => {
    seedDraft("", [], [personA]);
    renderPage("/overview/new?entwurf=abc");

    await user().click(await screen.findByRole("button", { name: "Abbrechen" }));

    expect(await screen.findByRole("heading", { name: "Übersicht" })).toBeInTheDocument();
    expect(drafts.has("abc")).toBe(true);
  });
});

describe("CreateTermin slot page", () => {
  it("explains what is wrong in place and keeps what was typed", async () => {
    seedDraft("A 1", [[5, 9, 10]]);
    renderPage("/overview/abc/zeitfenster/neu");
    await screen.findByRole("heading", { name: "Geben Sie Ihr verfügbares Zeitfenster an" });

    await fillSlot("5", ["9", "30"], ["9", "0"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Die Endzeit muss nach der Startzeit liegen.")).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Ende" })).getByRole("textbox", { name: "Stunde" }),
    ).toHaveValue("9");
    expect(
      within(screen.getByRole("group", { name: "Ende" })).getByRole("textbox", { name: "Stunde" }),
    ).toBeInvalid();
    expect(drafts.get("abc")!.slots).toHaveLength(1);
  });

  it("points out an overlap with another slot of the draft", async () => {
    seedDraft("A 1", [[5, 9, 11]]);
    renderPage("/overview/abc/zeitfenster/neu");
    await screen.findByRole("group", { name: "Datum" });

    await fillSlot("5", ["10", "0"], ["12", "0"]);
    await user().click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(
        "Dieses Zeitfenster überschneidet sich mit dem Zeitfenster am 5. Januar 2099, 09:00 bis 11:00.",
      ),
    ).toBeVisible();
  });

  it("returns to the form without saving when cancelled", async () => {
    seedDraft("A 1");
    renderPage("/overview/abc/zeitfenster/neu");

    await user().click(await screen.findByRole("link", { name: "Abbrechen" }));

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("A 1");
    expect(drafts.get("abc")!.slots).toHaveLength(0);
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
  it("summarizes the Aktenzeichen and the time windows by day", async () => {
    await reviewStep();

    const data = screen.getByRole("group", { name: "Verhandlungsdaten" });
    expect(within(data).getByText("574 C 65412/26")).toBeInTheDocument();
    const windows = screen.getByRole("group", { name: "Zeitfenster" });
    expect(within(windows).getByText("5. Januar 2099")).toBeInTheDocument();
    expect(within(windows).getByText("6. Januar 2099")).toBeInTheDocument();
    expect(within(windows).getAllByText("09:00 bis 10:00")).toHaveLength(2);
  });

  it("collapses and expands every section at once", async () => {
    await reviewStep();
    expect(sections().every((element) => element.open)).toBe(true);

    await user().click(screen.getByRole("button", { name: "Alle ausblenden" }));
    expect(sections().every((element) => !element.open)).toBe(true);

    await user().click(screen.getByRole("button", { name: "Alle einblenden" }));
    expect(sections().every((element) => element.open)).toBe(true);
  });

  it("leaves the sections as plain <details> and no bulk buttons without JavaScript", async () => {
    const routes = [
      {
        path: "/",
        Component: () => (
          <ReviewPage
            sections={[{ id: "a", title: "A", children: "x" }]}
            submit={{ label: "Los", intent: "go" }}
          />
        ),
      },
    ];
    const context = (await createStaticHandler(routes).query(
      new Request("http://localhost/"),
    )) as StaticHandlerContext;
    const html = renderToString(
      <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />,
    );

    expect(html).toContain("<details");
    expect(html).not.toContain("Alle einblenden");
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

  it("sends a draft that is not complete back to the form instead of reviewing it", async () => {
    seedDraft("A 1", [[5, 9, 10]]);
    renderPage("/overview/abc/confirm");

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("A 1");
    expect(publishAppointment).not.toHaveBeenCalled();
  });

  it("shows the next steps when the Terminumfrage is created", async () => {
    await reviewStep();

    await user().click(screen.getByRole("button", { name: "Terminumfrage erstellen" }));

    expect(
      await screen.findByRole("heading", { name: "Sie haben die Terminumfrage erstellt." }),
    ).toBeInTheDocument();
    expect(publishAppointment).toHaveBeenCalledWith(expect.anything(), "1", "abc");
  });

  it("does not publish a draft that became incomplete after it was reviewed", async () => {
    await reviewStep();
    drafts.get("abc")!.slots.pop();

    await user().click(screen.getByRole("button", { name: "Terminumfrage erstellen" }));

    expect(await screen.findByRole("textbox", { name: "Aktenzeichen" })).toHaveValue(
      "574 C 65412/26",
    );
    expect(publishAppointment).not.toHaveBeenCalled();
  });
});
