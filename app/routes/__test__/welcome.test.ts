// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../welcome";

const { handler, canSignIn } = vi.hoisted(() => ({ handler: vi.fn(), canSignIn: vi.fn() }));
vi.mock("~/lib/auth.server", () => ({ getAuth: () => ({ handler }) }));
vi.mock("~/adapters/users/users.server", () => ({ canSignIn }));
vi.mock("~/database/database", () => ({ getDb: () => ({}) }));
vi.mock("~/lib/logging", () => ({ logError: vi.fn() }));

function request(values: Record<string, string>) {
  return new Request("http://localhost/", {
    method: "POST",
    headers: { Origin: "http://localhost" },
    body: new URLSearchParams(values),
  });
}

describe("login action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canSignIn.mockResolvedValue(true);
  });

  it("rejects the old role-picker login and invalid email addresses", async () => {
    const inputs: Array<Record<string, string>> = [
      { role: "RICHTER" },
      { email: "" },
      { email: "invalid" },
      { email: "person@host" },
    ];
    for (const input of inputs) {
      expect(await action({ request: request(input) })).toMatchObject({
        init: { status: 400 },
        data: { invalidEmail: true },
      });
    }
    expect(canSignIn).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns the submitted address with an invalid-address error", async () => {
    expect(await action({ request: request({ email: "person@host" }) })).toMatchObject({
      data: { email: "person@host" },
    });
  });

  it("rejects addresses that may not sign in without sending a link", async () => {
    canSignIn.mockResolvedValue(false);
    expect(await action({ request: request({ email: " Person@Example.com " }) })).toMatchObject({
      init: { status: 403 },
      data: { notAllowed: true, email: " Person@Example.com " },
    });
    expect(canSignIn).toHaveBeenCalledWith({}, "person@example.com");
    expect(handler).not.toHaveBeenCalled();
  });

  it("forwards normalized email and origin through the HTTP handler", async () => {
    handler.mockResolvedValue(Response.json({ status: true }));
    expect(await action({ request: request({ email: " User@Example.com " }) })).toMatchObject({
      data: { sent: true, email: " User@Example.com " },
    });
    const forwarded: Request = handler.mock.calls[0]![0];
    expect(forwarded.url).toBe(
      "http://localhost/verhandlungstermin-finder/api/auth/sign-in/magic-link",
    );
    expect(forwarded.headers.get("Origin")).toBe("http://localhost");
    expect(await forwarded.json()).toEqual({
      email: "user@example.com",
      callbackURL: "/verhandlungstermin-finder/overview",
      errorCallbackURL: "/verhandlungstermin-finder/",
    });
  });

  it("reports delivery failures rather than confirming success", async () => {
    handler.mockResolvedValue(new Response("private SMTP diagnostic", { status: 500 }));
    expect(await action({ request: request({ email: "user@example.com" }) })).toMatchObject({
      init: { status: 500 },
      data: { error: expect.any(String) },
    });
  });

  it("logs out through POST and forwards cleared cookies on the redirect", async () => {
    handler.mockResolvedValue(
      new Response(null, {
        headers: { "Set-Cookie": "session=; Max-Age=0; Path=/" },
      }),
    );
    const response = await action({ request: request({ intent: "logout" }) });
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error("Expected a logout redirect");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.getSetCookie()).toEqual(["session=; Max-Age=0; Path=/"]);
    const forwarded: Request = handler.mock.calls[0]![0];
    expect(forwarded.url).toBe("http://localhost/verhandlungstermin-finder/api/auth/sign-out");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("Origin")).toBe("http://localhost");
  });

  it("does not redirect as if logout succeeded when the auth handler rejects it", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    handler.mockResolvedValue(forbidden);
    expect(await action({ request: request({ intent: "logout" }) })).toBe(forbidden);
  });
});
