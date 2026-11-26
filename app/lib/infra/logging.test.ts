// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo } from "./logging.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logError", () => {
  it("logs the message with the error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error("boom");

    logError("Something failed", cause);

    expect(error).toHaveBeenCalledWith("Something failed", cause);
  });

  it("logs only the message when there is no error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("Something failed");

    expect(error.mock.calls).toEqual([["Something failed"]]);
  });
});

describe("logInfo", () => {
  it("logs the message", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logInfo("Something happened");

    expect(info).toHaveBeenCalledWith("Something happened");
  });
});
