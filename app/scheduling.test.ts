import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./adapters/inMemory/inMemoryStore";
import { SchedulingQuery } from "./core/services/schedulingQuery";
import { SchedulingService } from "./core/services/schedulingService";

function buildFixture() {
  const store = new InMemoryStore();
  const service = new SchedulingService(store);
  const query = new SchedulingQuery(store);
  service.seedCase("verfahren-1", "Verfahren Test");
  return { service, query };
}

describe("SchedulingService", () => {
  it("confirms a mutually accepted slot when Richter explicitly selects it", () => {
    const { service, query } = buildFixture();

    service.richterSetSlots("verfahren-1", [
      {
        startsAtIso: "2026-05-20T08:00:00.000Z",
        endsAtIso: "2026-05-20T09:00:00.000Z",
      },
      {
        startsAtIso: "2026-05-20T10:00:00.000Z",
        endsAtIso: "2026-05-20T11:00:00.000Z",
      },
    ]);

    const before = query.getOverview("verfahren-1");
    const targetSlotId = before.slots[1].id;

    service.partySubmitDecisions("verfahren-1", "KLAEGER", {
      [before.slots[0].id]: "REJECT",
      [targetSlotId]: "ACCEPT",
    });

    service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
      [before.slots[0].id]: "ACCEPT",
      [targetSlotId]: "ACCEPT",
    });

    expect(query.getOverview("verfahren-1").finalSlotId).toBeNull();

    service.richterConfirmSlot("verfahren-1", targetSlotId);

    expect(query.getOverview("verfahren-1").finalSlotId).toBe(targetSlotId);
  });

  it("rejects confirming a slot that is not mutually accepted", () => {
    const { service, query } = buildFixture();

    service.richterSetSlots("verfahren-1", [
      {
        startsAtIso: "2026-05-20T08:00:00.000Z",
        endsAtIso: "2026-05-20T09:00:00.000Z",
      },
    ]);

    const slotId = query.getOverview("verfahren-1").slots[0].id;

    expect(() => service.richterConfirmSlot("verfahren-1", slotId)).toThrow(
      /mutually accepted/,
    );
  });

  it("locks party submissions after one submit until Richter unlocks", () => {
    const { service, query } = buildFixture();

    service.richterSetSlots("verfahren-1", [
      {
        startsAtIso: "2026-05-20T08:00:00.000Z",
        endsAtIso: "2026-05-20T09:00:00.000Z",
      },
    ]);

    const slotId = query.getOverview("verfahren-1").slots[0].id;

    service.partySubmitDecisions("verfahren-1", "KLAEGER", {
      [slotId]: "ACCEPT",
    });

    expect(() =>
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "REJECT",
      }),
    ).toThrow(/locked/);

    service.richterUnlockSubmission("verfahren-1", "KLAEGER");

    expect(() =>
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "REJECT",
      }),
    ).not.toThrow();
  });
});
