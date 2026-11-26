// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { xjustizErrors } from "~tests/xjustiz";

import type { ErvVersandClient } from "../infra/erv-versand/erv-versand-client.ts";
import { ervVersandClient } from "../infra/erv-versand/erv-versand-connection.ts";
import { logError, logInfo } from "../infra/logging.ts";
import { renderErvInvitationPdf } from "./erv-invitation-pdf.ts";
import { sendErvInvitation } from "./send-erv-invitation.ts";

vi.mock("../infra/logging.ts", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../infra/erv-versand/erv-versand-connection.ts", () => ({ ervVersandClient: vi.fn() }));
vi.mock("./erv-invitation-pdf.ts", async (importOriginal) => ({
  ...(await importOriginal()),
  renderErvInvitationPdf: vi.fn(),
}));

const SAFE_ID = "DE.Example.00000000-0000-4000-8000-000000000001.0001";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slots = [
  { id: "s1", start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
];
const invitation = {
  appointmentId: "a1",
  participantId: "p1",
  safeId: SAFE_ID,
  name: "Person A",
  aktenzeichen: "574 C 7/26",
  slots,
  token: "tok-p1",
  correlationId: "c1",
  now: new Date("2026-11-25T10:00:00Z"),
};

const client = {
  sendEgvpMessage: vi.fn<ErvVersandClient["sendEgvpMessage"]>(),
  sendEgvpExampleMessage: vi.fn(),
  close: vi.fn(async () => {}),
};

const decode = (content: string | undefined) => Buffer.from(content ?? "", "base64");

// What was handed to the Basisdienst, decoded.
function sent() {
  const [{ receiver, xjustizMessage, attachments }, correlationId] =
    client.sendEgvpMessage.mock.calls[0]!;
  return {
    receiver,
    correlationId,
    xml: decode(xjustizMessage.content).toString("utf8"),
    attachments: (attachments ?? []).map(({ name, content }) => ({
      name,
      content: decode(content),
    })),
  };
}

const elements = (xml: string, element: string) =>
  [...xml.matchAll(new RegExp(`<tns:${element}[^>]*>([^<]*)</tns:${element}>`, "g"))].map(
    ([, value]) => value,
  );

// The recipient, named in the second free-text element after the sender.
const recipient = (xml: string) => elements(xml, "sonstige")[1];

// Everything that was logged, to check that no SAFE-ID gets into the log.
const logged = () =>
  JSON.stringify([...vi.mocked(logInfo).mock.calls, ...vi.mocked(logError).mock.calls]);

beforeEach(() => {
  vi.stubEnv("BASE_URL", "http://localhost:3000");
  vi.mocked(renderErvInvitationPdf).mockResolvedValue(Buffer.from("%PDF-test"));
  vi.mocked(ervVersandClient).mockResolvedValue(client);
  client.sendEgvpMessage.mockResolvedValue();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sendErvInvitation", () => {
  it("hands the SAFE-ID an XJustiz message with the invitation PDF over", async () => {
    expect(await sendErvInvitation(invitation)).toBe(true);

    const { receiver, correlationId, xml, attachments } = sent();
    expect(receiver).toBe(SAFE_ID);
    expect(correlationId).toBe("c1");
    expect(await xjustizErrors(xml)).toEqual([]);
    expect(elements(xml, "kurzrubrum")).toEqual(["Terminumfrage zum Aktenzeichen 574 C 7/26"]);
    expect(recipient(xml)).toBe("Person A");
    expect(elements(xml, "erstellungszeitpunkt")).toEqual(["2026-11-25T10:00:00.000Z"]);

    // The message references the attachment by the file name the beA expects.
    expect(elements(xml, "dateiname")).toEqual(["Nachrichtentext.pdf"]);
    expect(attachments).toEqual([
      { name: "Nachrichtentext.pdf", content: Buffer.from("%PDF-test") },
    ]);
    const [messageId] = elements(xml, "eigeneNachrichtenID");
    const [documentId] = elements(xml, "id");
    expect(messageId).toMatch(UUID);
    expect(documentId).toMatch(UUID);
    expect(messageId).not.toBe(documentId);
  });

  it("names the commit the app was built from as its version, or local", async () => {
    vi.stubEnv("COMMIT_SHA", "0123abc");
    await sendErvInvitation(invitation);
    expect(elements(sent().xml, "version")).toEqual(["0123abc"]);

    client.sendEgvpMessage.mockClear();
    vi.stubEnv("COMMIT_SHA", "");
    await sendErvInvitation(invitation);
    expect(elements(sent().xml, "version")).toEqual(["local"]);
  });

  it("puts the personal survey link into the PDF", async () => {
    await sendErvInvitation(invitation);

    expect(renderErvInvitationPdf).toHaveBeenCalledWith({
      aktenzeichen: "574 C 7/26",
      name: "Person A",
      slots,
      surveyUrl: "http://localhost:3000/verhandlungstermin-finder/umfrage/tok-p1",
    });
  });

  it("addresses a guest without a name by the SAFE-ID", async () => {
    await sendErvInvitation({ ...invitation, name: null });

    expect(recipient(sent().xml)).toBe(SAFE_ID);
    expect(renderErvInvitationPdf).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it("logs the handover by ids and correlation ID only", async () => {
    await sendErvInvitation(invitation);

    expect(client.sendEgvpExampleMessage).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 handed over (correlation ID c1)",
    );
    expect(logged()).not.toContain(SAFE_ID);
    expect(logged()).not.toContain("tok-p1");
  });

  it("hands nothing over without the base URL for the survey link", async () => {
    vi.stubEnv("BASE_URL", "");

    expect(await sendErvInvitation(invitation)).toBe(false);

    expect(logError).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 not sent",
      expect.objectContaining({ message: expect.stringContaining("BASE_URL") }),
    );
    expect(client.sendEgvpMessage).not.toHaveBeenCalled();
  });

  it("hands nothing over when the PDF cannot be rendered", async () => {
    const broken = new Error("Font missing");
    vi.mocked(renderErvInvitationPdf).mockRejectedValue(broken);

    expect(await sendErvInvitation(invitation)).toBe(false);

    expect(logError).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 not sent",
      broken,
    );
    expect(client.sendEgvpMessage).not.toHaveBeenCalled();
  });

  it("hands nothing over for a value that is not a SAFE-ID", async () => {
    expect(await sendErvInvitation({ ...invitation, safeId: "DE.Example.1" })).toBe(false);

    expect(ervVersandClient).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 not sent: not a SAFE-ID",
    );
    expect(logged()).not.toContain("DE.Example.1");
  });

  it("returns false when the Basisdienst cannot be reached", async () => {
    const refused = new Error("ECONNREFUSED");
    vi.mocked(ervVersandClient).mockRejectedValue(refused);

    expect(await sendErvInvitation(invitation)).toBe(false);

    expect(logError).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 not sent",
      refused,
    );
  });

  it("returns false when the broker does not confirm the request", async () => {
    const nacked = new Error("nacked");
    client.sendEgvpMessage.mockRejectedValue(nacked);

    expect(await sendErvInvitation(invitation)).toBe(false);

    expect(logError).toHaveBeenCalledWith(
      "ERV invitation to participant p1 of a1 not sent",
      nacked,
    );
  });
});
