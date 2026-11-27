import { describe, expect, it } from "vitest";

import { intent, parseIntent, type DraftIntent } from "./intent";

describe("draft intents", () => {
  it.each<[DraftIntent, string]>([
    [{ command: "next" }, "next"],
    [{ command: "cancel" }, "cancel"],
    [{ command: "add-slot" }, "add-slot"],
    [{ command: "add-person" }, "add-person"],
    [{ command: "edit-court" }, "edit-court"],
    [{ command: "edit-slot", id: "s-1" }, "edit-slot:s-1"],
    [{ command: "copy-slot", id: "s-1" }, "copy-slot:s-1"],
    [{ command: "delete-slot", id: "s-1" }, "delete-slot:s-1"],
    [{ command: "edit-person", id: "p-1" }, "edit-person:p-1"],
    [{ command: "delete-person", id: "p-1" }, "delete-person:p-1"],
  ])("writes %o as %s and reads it back", (value, written) => {
    expect(intent(value)).toBe(written);
    expect(parseIntent(written)).toEqual(value);
  });

  it("keeps everything after the first separator as the row id", () => {
    expect(parseIntent("edit-slot:a:b")).toEqual({ command: "edit-slot", id: "a:b" });
  });

  it.each([
    ["nothing", null],
    ["an empty value", ""],
    ["an unknown command", "explode"],
    ["an unknown row command", "explode:s-1"],
    ["a row command without an id", "edit-slot"],
    ["a row command with an empty id", "delete-person:"],
    ["a form command with an id", "next:s-1"],
    ["another page's intent", "invite-email:p-1"],
  ])("rejects %s", (_case, value) => {
    expect(parseIntent(value)).toBeUndefined();
  });

  it("rejects a file", () => {
    expect(parseIntent(new File([], "f"))).toBeUndefined();
  });
});
