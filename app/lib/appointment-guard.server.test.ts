// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment, type Appointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import {
  appointmentIdOf,
  getOwnAppointment,
  PUBLISHED,
  requireOwnAppointment,
} from "./appointment-guard.server";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "u1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const appointment = (status: Appointment["status"]): Appointment => ({
  id: "a/1",
  aktenzeichen: "Az. 1",
  status,
  slots: [],
});

const request = () => new Request("http://localhost:3000/overview/a1");

// What the guard threw: a redirect or an error response.
async function thrown(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the guard to throw");
}

describe("appointmentIdOf", () => {
  it("reads the id from the route params", () => {
    expect(appointmentIdOf({ appointmentId: "a1" })).toBe("a1");
  });

  it("gives an empty id, which matches no appointment, when the param is missing", () => {
    expect(appointmentIdOf({})).toBe("");
  });
});

describe("getOwnAppointment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user's own appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("draft"));

    await expect(getOwnAppointment("u1", "a/1")).resolves.toEqual(appointment("draft"));
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "u1", "a/1");
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(getOwnAppointment("u1", "a/1")).rejects.toMatchObject({
      data: "Not found",
      init: { status: 404 },
    });
  });

  it("answers 404 before looking at the status", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(
      getOwnAppointment("u1", "a/1", { status: "draft", otherwise: "/overview" }),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("accepts an appointment in the required state", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("open"));

    await expect(
      getOwnAppointment("u1", "a/1", { status: "open", otherwise: "/overview" }),
    ).resolves.toEqual(appointment("open"));
  });

  it("accepts any of several states", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("cancelled"));

    await expect(
      getOwnAppointment("u1", "a/1", { status: PUBLISHED, otherwise: "/overview" }),
    ).resolves.toEqual(appointment("cancelled"));
  });

  it("redirects an appointment in another state to the given path", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("open"));

    const response = await thrown(
      getOwnAppointment("u1", "a/1", { status: "draft", otherwise: "/overview" }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/overview");
  });

  it("builds the redirect target from the requested id", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("draft"));

    const response = await thrown(
      getOwnAppointment("u1", "a/1", {
        status: PUBLISHED,
        otherwise: (id) => `/overview/${encodeURIComponent(id)}/confirm`,
      }),
    );

    expect((response as Response).headers.get("Location")).toBe("/overview/a%2F1/confirm");
  });
});

describe("requireOwnAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
  });

  it("returns the judge, the id and their appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("open"));

    await expect(requireOwnAppointment(request(), { appointmentId: "a/1" })).resolves.toEqual({
      user: judge,
      id: "a/1",
      appointment: appointment("open"),
    });
    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), "richter");
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "u1", "a/1");
  });

  it("requires the richter role before reading the appointment", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(requireOwnAppointment(request(), { appointmentId: "a/1" })).rejects.toBe(
      forbidden,
    );
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("only reads appointments of the signed-in judge", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(requireOwnAppointment(request(), { appointmentId: "a/1" })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, judge.id, "a/1");
  });

  it("looks up an empty id when the param is missing", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(requireOwnAppointment(request(), {})).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "u1", "");
  });

  it("redirects an appointment in the wrong state", async () => {
    vi.mocked(getAppointment).mockResolvedValue(appointment("confirmed"));

    const response = await thrown(
      requireOwnAppointment(
        request(),
        { appointmentId: "a/1" },
        { status: "open", otherwise: (id) => `/overview/${encodeURIComponent(id)}` },
      ),
    );

    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/overview/a%2F1");
  });
});
