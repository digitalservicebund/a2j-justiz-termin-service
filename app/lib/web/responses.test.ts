// @vitest-environment node
import { describe, expect, it } from "vitest";

import { badRequest, notFound } from "./responses.ts";

describe("responses", () => {
  it("answers not found with 404", () => {
    expect(notFound()).toMatchObject({ data: "Not found", init: { status: 404 } });
  });

  it("answers bad request with 400", () => {
    expect(badRequest()).toMatchObject({ data: "Bad request", init: { status: 400 } });
  });
});
