// @vitest-environment node
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { callLoader } from "~tests/route";

import { findInvitee, type Invitee } from "~/adapters/appointments/invitations.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";
import { renderErvInvitationPdf } from "~/lib/erv/erv-invitation-pdf";

import { ervPdfFileName, loader } from "./erv-pdf";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/invitations.server", () => ({ findInvitee: vi.fn() }));
vi.mock("~/lib/erv/erv-invitation-pdf", () => ({ renderErvInvitationPdf: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const slots = [
  { id: "s1", start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
];

const invitee: Invitee = {
  id: "p1",
  name: "Person A",
  email: null,
  safeId: "DE.Example.1",
  token: "tok-p1",
  aktenzeichen: "574 C 7/26",
  slots,
};

const params = { appointmentId: "a1", participantId: "p1" };
const download = () =>
  callLoader(loader, {
    request: new Request("http://localhost:3000/overview/a1/verfahrensbeteiligte/p1/erv.pdf"),
    params,
  });

describe("ERV PDF route", () => {
  let info: MockInstance<typeof console.info>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BASE_URL", "http://localhost:3000");
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(findInvitee).mockResolvedValue(invitee);
    vi.mocked(renderErvInvitationPdf).mockResolvedValue(Buffer.from("%PDF-test"));
  });

  it("downloads the guest's invitation with their personal survey link", async () => {
    const outcome = await download();

    expect(findInvitee).toHaveBeenCalledWith({ db: true }, "1", "a1", "p1");
    expect(renderErvInvitationPdf).toHaveBeenCalledWith({
      aktenzeichen: "574 C 7/26",
      name: "Person A",
      slots,
      surveyUrl: "http://localhost:3000/verhandlungstermin-finder/umfrage/tok-p1",
    });
    expect(outcome.status).toBe(200);
    expect(outcome.headers.get("Content-Type")).toBe("application/pdf");
    expect(outcome.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Einladung-Terminumfrage-574-C-7-26-Person-A.pdf"',
    );
    expect(outcome.headers.get("Cache-Control")).toBe("no-store");
  });

  it("logs ids only, never the SAFE-ID or the token", async () => {
    await download();

    expect(info).toHaveBeenCalledWith("ERV PDF generated for participant p1 of a1");
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).not.toContain("DE.Example.1");
    expect(logged).not.toContain("tok-p1");
  });

  it("does not put the SAFE-ID in place of a missing name", async () => {
    vi.mocked(findInvitee).mockResolvedValue({ ...invitee, name: "DE.Example.1" });

    const outcome = await download();

    expect(renderErvInvitationPdf).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
    expect(outcome.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Einladung-Terminumfrage-574-C-7-26.pdf"',
    );
  });

  it("does not put the e-mail address in place of a missing name", async () => {
    vi.mocked(findInvitee).mockResolvedValue({
      ...invitee,
      email: "person.a@example.com",
      name: "person.a@example.com",
    });

    await download();

    expect(renderErvInvitationPdf).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    expect(await download()).toMatchObject({ thrown: true, status: 403 });
    expect(findInvitee).not.toHaveBeenCalled();
  });

  it("answers 404 for a guest of another judge, an unknown guest or a closed survey", async () => {
    vi.mocked(findInvitee).mockResolvedValue(undefined);

    expect(await download()).toMatchObject({ thrown: true, status: 404 });
    expect(renderErvInvitationPdf).not.toHaveBeenCalled();
  });

  it("answers 400 for a guest without a SAFE-ID", async () => {
    vi.mocked(findInvitee).mockResolvedValue({ ...invitee, safeId: null });

    expect(await download()).toMatchObject({ thrown: true, status: 400 });
    expect(renderErvInvitationPdf).not.toHaveBeenCalled();
  });
});

describe("ervPdfFileName", () => {
  it("keeps letters and digits, spells out umlauts and drops accents", () => {
    expect(ervPdfFileName("12 O 3456/26 (ä)", "Person Ü-Renée")).toBe(
      "Einladung-Terminumfrage-12-O-3456-26-ae-Person-Ue-Renee.pdf",
    );
  });

  it("leaves out a missing name", () => {
    expect(ervPdfFileName("574 C 7/26", null)).toBe("Einladung-Terminumfrage-574-C-7-26.pdf");
  });
});
