// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findSurvey, type Survey } from "../adapters/appointments/survey.server.ts";
import { requireSurvey } from "./survey-guard.server.ts";

vi.mock("../adapters/appointments/survey.server.ts", () => ({ findSurvey: vi.fn() }));
vi.mock("../database/database.ts", () => ({ getDb: () => ({ db: true }) }));

const survey = { appointmentId: "a1", aktenzeichen: "Az. 1" } as Survey;

describe("requireSurvey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the token and the open survey it points to", async () => {
    vi.mocked(findSurvey).mockResolvedValue(survey);

    await expect(requireSurvey({ token: "tok1" })).resolves.toEqual({ token: "tok1", survey });
    expect(findSurvey).toHaveBeenCalledWith({ db: true }, "tok1");
  });

  it("answers 404 for an unknown or closed survey", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(requireSurvey({ token: "tok1" })).rejects.toMatchObject({
      data: "Not found",
      init: { status: 404 },
    });
  });

  it("looks up an empty token, which matches no survey, when the param is missing", async () => {
    vi.mocked(findSurvey).mockResolvedValue(undefined);

    await expect(requireSurvey({})).rejects.toMatchObject({ init: { status: 404 } });
    expect(findSurvey).toHaveBeenCalledWith({ db: true }, "");
  });
});
