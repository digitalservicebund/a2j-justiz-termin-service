import { describe, expect, it } from "vitest";

import {
  appointmentPath,
  appointmentUrl,
  confirmDraftPath,
  confirmSelectionPath,
  createdPath,
  draftPath,
  NEW_ITEM,
  participantPath,
  selectedPath,
  selectPath,
  slotPath,
  smallerWindowPagePath,
  surveyPath,
  surveyResultPath,
  surveySummaryPath,
  surveyUrl,
} from "./paths.ts";

describe("appointment paths", () => {
  it("builds the pages of a Terminumfrage with an encoded id", () => {
    expect(appointmentPath("a/1")).toBe("/overview/a%2F1");
    expect(confirmDraftPath("a/1")).toBe("/overview/a%2F1/confirm");
    expect(createdPath("a/1")).toBe("/overview/a%2F1/created");
    expect(selectedPath("a/1")).toBe("/overview/a%2F1/selected");
  });

  it("continues a draft in the form", () => {
    expect(draftPath("a/1")).toBe("/overview/new?entwurf=a%2F1");
  });

  it("builds the pages of a slot and a person, new or existing", () => {
    expect(slotPath("a1", NEW_ITEM)).toBe("/overview/a1/zeitfenster/neu");
    expect(slotPath("a1", "s/1")).toBe("/overview/a1/zeitfenster/s%2F1");
    expect(slotPath("a1", NEW_ITEM, "s/1")).toBe("/overview/a1/zeitfenster/neu?kopie=s%2F1");
    expect(participantPath("a1", NEW_ITEM)).toBe("/overview/a1/verfahrensbeteiligte/neu");
    expect(participantPath("a1", "p/1")).toBe("/overview/a1/verfahrensbeteiligte/p%2F1");
  });

  it("carries the choice of a Termin in the query", () => {
    expect(selectPath("a1")).toBe("/overview/a1/select");
    expect(selectPath("a1", "fenster=w1")).toBe("/overview/a1/select?fenster=w1");
    expect(selectPath("a1", "")).toBe("/overview/a1/select?");
    expect(confirmSelectionPath("a1", "fenster=w1")).toBe("/overview/a1/select/confirm?fenster=w1");
  });

  it("builds the full link of a Terminumfrage below the base path", () => {
    expect(appointmentUrl("https://example.com", "a/1")).toBe(
      "https://example.com/verhandlungstermin-finder/overview/a%2F1",
    );
  });
});

describe("survey paths", () => {
  it("builds survey paths with an encoded token", () => {
    expect(surveyPath("a/b")).toBe("/umfrage/a%2Fb");
    expect(surveyPath("a1", "name=Guest+C")).toBe("/umfrage/a1?name=Guest+C");
    expect(surveyPath("a1", "")).toBe("/umfrage/a1?");
  });

  it("builds the pages of a survey", () => {
    expect(smallerWindowPagePath("a/b", "angebot=o1")).toBe(
      "/umfrage/a%2Fb/zeitfenster?angebot=o1",
    );
    expect(surveySummaryPath("a/b", "keines=1")).toBe("/umfrage/a%2Fb/zusammenfassung?keines=1");
    expect(surveyResultPath("a/b", "p/1")).toBe(
      "/umfrage/a%2Fb/naechste-schritte?teilnehmer=p%2F1",
    );
  });

  it("builds the full survey link below the base path", () => {
    expect(surveyUrl("https://example.com", "a/b")).toBe(
      "https://example.com/verhandlungstermin-finder/umfrage/a%2Fb",
    );
  });
});
