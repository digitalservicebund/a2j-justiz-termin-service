import { vi } from "vitest";

// A stand-in for app/lib/infra/logging.ts, for tests that check what is logged:
//   vi.mock("~/lib/infra/logging", async () => (await import("~tests/logging")).loggingMock());
// Then assert on the mocked functions, e.g. expect(log.error).toHaveBeenCalledWith({ err }, "…").
export function loggingMock() {
  return {
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    },
    logAudit: vi.fn(),
    SYSTEM_ACTOR: "system",
    CLI_ACTOR: "cli",
  };
}

// Everything that was logged through the mocked `log` (and `logAudit`), as one string, to check
// that no personal data gets into the log: allLogged(log, logAudit).
export function allLogged(log: object, logAudit?: unknown): string {
  return JSON.stringify(
    [...Object.values(log), logAudit].flatMap((fn) => (vi.isMockFunction(fn) ? fn.mock.calls : [])),
  );
}
