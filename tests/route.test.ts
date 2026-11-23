// @vitest-environment node
import { data, redirect } from "react-router";
import { describe, expect, expectTypeOf, it } from "vitest";

import { callAction, callLoader } from "./route";

// Answers like a typical form action: data() with errors on failure, a redirect on success.
const validatingAction = async (fail: boolean) =>
  fail ? data({ errors: { name: "Missing" } }, { status: 400 }) : redirect("/");

describe("callLoader and callAction", () => {
  it("describe a plain object as data with status 200", async () => {
    const outcome = await callLoader(async () => ({ user: "Person A" }), {});

    expect(outcome).toEqual({
      thrown: false,
      status: 200,
      location: null,
      headers: new Headers(),
      data: { user: "Person A" },
    });
  });

  it("unwrap data() and keep its status and headers", async () => {
    const outcome = await callAction(
      async () => data({ errors: { name: "Missing" } }, { status: 400, headers: { "X-A": "1" } }),
      {},
    );

    expect(outcome).toMatchObject({
      thrown: false,
      status: 400,
      data: { errors: { name: "Missing" } },
    });
    expect(outcome.headers.get("X-A")).toBe("1");
  });

  it("take the status of data() given as a number", async () => {
    const outcome = await callAction(async () => data({ error: "Invalid" }, 400), {});

    expect(outcome).toMatchObject({ status: 400, data: { error: "Invalid" } });
  });

  it("describe a returned redirect by its status and location", async () => {
    const outcome = await callAction(async () => redirect("/overview"), {});

    expect(outcome).toMatchObject({
      thrown: false,
      status: 302,
      location: "/overview",
      data: undefined,
    });
  });

  it("describe a thrown redirect and a thrown data() as thrown", async () => {
    const thrownRedirect = await callLoader(async () => {
      throw redirect("/umfrage/t1");
    }, {});
    const thrownData = await callLoader(async () => {
      throw data(null, { status: 404 });
    }, {});

    expect(thrownRedirect).toMatchObject({ thrown: true, status: 302, location: "/umfrage/t1" });
    expect(thrownData).toMatchObject({ thrown: true, status: 404, data: null });
  });

  it("rethrow any other error", async () => {
    const failure = new Error("Database down");

    await expect(
      callLoader(async () => {
        throw failure;
      }, {}),
    ).rejects.toBe(failure);
  });

  it("pass the arguments through", async () => {
    const outcome = await callLoader(async ({ id }: { id: string }) => ({ id }), { id: "a1" });

    expect(outcome.data).toEqual({ id: "a1" });
  });

  it("type the data of a returned answer without the Response and data() wrappers", async () => {
    const outcome = await callAction(validatingAction, true);

    if (outcome.thrown) throw new Error("Expected a returned answer");
    expectTypeOf(outcome.data).toEqualTypeOf<{ errors: { name: string } } | undefined>();
  });
});
