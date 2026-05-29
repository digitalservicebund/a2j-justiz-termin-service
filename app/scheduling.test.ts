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

const SLOT_A = {
  startsAtIso: "2026-05-20T08:00:00.000Z",
  endsAtIso: "2026-05-20T09:00:00.000Z",
};
const SLOT_B = {
  startsAtIso: "2026-05-20T10:00:00.000Z",
  endsAtIso: "2026-05-20T11:00:00.000Z",
};

describe("SchedulingService", () => {
  describe("richterSetSlots", () => {
    it("confirms a mutually accepted slot when Richter explicitly selects it", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A, SLOT_B]);

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

    it("throws when given an empty slot array", () => {
      const { service } = buildFixture();
      expect(() => service.richterSetSlots("verfahren-1", [])).toThrow(
        /at least one/i,
      );
    });

    it("throws when a slot has invalid ISO date strings", () => {
      const { service } = buildFixture();
      expect(() =>
        service.richterSetSlots("verfahren-1", [
          { startsAtIso: "not-a-date", endsAtIso: "2026-05-20T09:00:00.000Z" },
        ]),
      ).toThrow(/valid ISO/i);
    });

    it("throws when a slot ends before it starts", () => {
      const { service } = buildFixture();
      expect(() =>
        service.richterSetSlots("verfahren-1", [
          {
            startsAtIso: "2026-05-20T09:00:00.000Z",
            endsAtIso: "2026-05-20T08:00:00.000Z",
          },
        ]),
      ).toThrow(/end after/i);
    });

    it("resets decisions and submission state when slots are replaced", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });

      service.richterSetSlots("verfahren-1", [SLOT_B]);

      const overview = query.getOverview("verfahren-1");
      expect(overview.hasSubmitted.KLAEGER).toBe(false);
      expect(overview.statuses[0].klaegerDecision).toBeNull();
    });
  });

  describe("richterDeleteSlot", () => {
    it("removes the slot from the list", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A, SLOT_B]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      service.richterDeleteSlot("verfahren-1", slotId);

      expect(query.getOverview("verfahren-1").slots).toHaveLength(1);
    });

    it("clears confirmedSlotId when the confirmed slot is deleted", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });
      service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
        [slotId]: "ACCEPT",
      });
      service.richterConfirmSlot("verfahren-1", slotId);
      expect(query.getOverview("verfahren-1").finalSlotId).toBe(slotId);

      service.richterDeleteSlot("verfahren-1", slotId);

      expect(query.getOverview("verfahren-1").finalSlotId).toBeNull();
    });

    it("throws when the slot does not exist", () => {
      const { service } = buildFixture();
      service.richterSetSlots("verfahren-1", [SLOT_A]);
      expect(() =>
        service.richterDeleteSlot("verfahren-1", "nonexistent"),
      ).toThrow(/not found/i);
    });

    it("resets submission locks for both parties", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A, SLOT_B]);
      const { slots } = query.getOverview("verfahren-1");
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slots[0].id]: "ACCEPT",
        [slots[1].id]: "ACCEPT",
      });
      expect(query.getOverview("verfahren-1").hasSubmitted.KLAEGER).toBe(true);

      service.richterDeleteSlot("verfahren-1", slots[1].id);

      expect(query.getOverview("verfahren-1").hasSubmitted.KLAEGER).toBe(false);
    });
  });

  describe("richterDeleteAllSlots", () => {
    it("clears slots, decisions, and confirmed slot", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });
      service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
        [slotId]: "ACCEPT",
      });
      service.richterConfirmSlot("verfahren-1", slotId);

      service.richterDeleteAllSlots("verfahren-1");

      const overview = query.getOverview("verfahren-1");
      expect(overview.slots).toHaveLength(0);
      expect(overview.statuses).toHaveLength(0);
      expect(overview.finalSlotId).toBeNull();
      expect(overview.hasSubmitted.KLAEGER).toBe(false);
      expect(overview.hasSubmitted.BEKLAGTER).toBe(false);
    });
  });

  describe("richterConfirmSlot", () => {
    it("rejects confirming a slot that is not mutually accepted", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      expect(() => service.richterConfirmSlot("verfahren-1", slotId)).toThrow(
        /mutually accepted/,
      );
    });

    it("throws when the slot id does not exist", () => {
      const { service } = buildFixture();
      service.richterSetSlots("verfahren-1", [SLOT_A]);
      expect(() =>
        service.richterConfirmSlot("verfahren-1", "nonexistent"),
      ).toThrow(/not found/i);
    });
  });

  describe("partySubmitDecisions", () => {
    it("locks party submissions after one submit until Richter unlocks", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
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

    it("throws when there are no slots yet", () => {
      const { service } = buildFixture();
      expect(() =>
        service.partySubmitDecisions("verfahren-1", "KLAEGER", {}),
      ).toThrow(/no time slots/i);
    });

    it("throws when not all slots are covered", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A, SLOT_B]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      expect(() =>
        service.partySubmitDecisions("verfahren-1", "KLAEGER", {
          [slotId]: "ACCEPT",
        }),
      ).toThrow(/every time slot/i);
    });

    it("throws when an unknown slot id is submitted", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      expect(() =>
        service.partySubmitDecisions("verfahren-1", "KLAEGER", {
          [slotId]: "ACCEPT",
          "unknown-slot": "REJECT",
        }),
      ).toThrow(/every time slot/i);
    });

    it("BEKLAGTER submission is independent of KLAEGER lock", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;

      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });

      expect(() =>
        service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
          [slotId]: "ACCEPT",
        }),
      ).not.toThrow();
    });
  });

  describe("richterUnlockSubmission", () => {
    it("clears the party's decisions and resets confirmedSlotId", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });
      service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
        [slotId]: "ACCEPT",
      });
      service.richterConfirmSlot("verfahren-1", slotId);

      service.richterUnlockSubmission("verfahren-1", "KLAEGER");

      const overview = query.getOverview("verfahren-1");
      expect(overview.hasSubmitted.KLAEGER).toBe(false);
      expect(overview.statuses[0].klaegerDecision).toBeNull();
      expect(overview.finalSlotId).toBeNull();
    });

    it("does not affect the other party's submission", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      const slotId = query.getOverview("verfahren-1").slots[0].id;
      service.partySubmitDecisions("verfahren-1", "KLAEGER", {
        [slotId]: "ACCEPT",
      });
      service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
        [slotId]: "ACCEPT",
      });

      service.richterUnlockSubmission("verfahren-1", "KLAEGER");

      const overview = query.getOverview("verfahren-1");
      expect(overview.hasSubmitted.BEKLAGTER).toBe(true);
      expect(overview.statuses[0].beklagterDecision).toBe("ACCEPT");
    });
  });

  describe("seedCase", () => {
    it("is idempotent — calling twice does not overwrite the case", () => {
      const { service, query } = buildFixture();

      service.richterSetSlots("verfahren-1", [SLOT_A]);
      service.seedCase("verfahren-1", "Different Name");

      expect(query.getOverview("verfahren-1").slots).toHaveLength(1);
      expect(query.getOverview("verfahren-1").name).toBe("Verfahren Test");
    });
  });
});

describe("SchedulingQuery", () => {
  it("throws when the case does not exist", () => {
    const store = new InMemoryStore();
    const query = new SchedulingQuery(store);
    expect(() => query.getOverview("nonexistent")).toThrow(/not found/i);
  });

  it("reports isMutuallyAccepted only when both parties accept", () => {
    const store = new InMemoryStore();
    const service = new SchedulingService(store);
    const query = new SchedulingQuery(store);
    service.seedCase("verfahren-1", "Test");

    service.richterSetSlots("verfahren-1", [SLOT_A]);
    const slotId = query.getOverview("verfahren-1").slots[0].id;

    service.partySubmitDecisions("verfahren-1", "KLAEGER", {
      [slotId]: "ACCEPT",
    });
    expect(query.getOverview("verfahren-1").statuses[0].isMutuallyAccepted).toBe(false);

    service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
      [slotId]: "ACCEPT",
    });
    expect(query.getOverview("verfahren-1").statuses[0].isMutuallyAccepted).toBe(true);
  });

  it("reports isMutuallyAccepted as false when one party rejects", () => {
    const store = new InMemoryStore();
    const service = new SchedulingService(store);
    const query = new SchedulingQuery(store);
    service.seedCase("verfahren-1", "Test");

    service.richterSetSlots("verfahren-1", [SLOT_A]);
    const slotId = query.getOverview("verfahren-1").slots[0].id;

    service.partySubmitDecisions("verfahren-1", "KLAEGER", {
      [slotId]: "ACCEPT",
    });
    service.partySubmitDecisions("verfahren-1", "BEKLAGTER", {
      [slotId]: "REJECT",
    });

    expect(query.getOverview("verfahren-1").statuses[0].isMutuallyAccepted).toBe(false);
  });
});
