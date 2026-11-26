// @vitest-environment node
import { describe, expect, it } from "vitest";
import { xjustizErrors } from "~tests/xjustiz";

import { ERV_INVITATION_FILE_NAME, ervInvitationMessage } from "./erv-invitation-message.ts";

const message = {
  aktenzeichen: "574 C 7/26",
  recipient: "Person A",
  messageId: "00000000-0000-4000-8000-0000000000a1",
  documentId: "00000000-0000-4000-8000-0000000000d1",
  version: "0123abc",
  now: new Date("2026-11-25T23:30:00Z"),
};

const text = (xml: string, element: string) =>
  [...xml.matchAll(new RegExp(`<tns:${element}[^>]*>([^<]*)</tns:${element}>`, "g"))].map(
    ([, value]) => value,
  );

describe("ervInvitationMessage", () => {
  it("is a valid XJustiz 3.6.2 message", async () => {
    expect(await xjustizErrors(ervInvitationMessage(message))).toEqual([]);
  });

  it("stays valid with characters XML has to escape", async () => {
    const xml = ervInvitationMessage({
      ...message,
      aktenzeichen: "1 <A> & 2/26",
      recipient: `Person "B" & Söhne <Kanzlei> d'Ä`,
    });

    expect(await xjustizErrors(xml)).toEqual([]);
    expect(text(xml, "sonstige")[1]).toBe(
      "Person &quot;B&quot; &amp; Söhne &lt;Kanzlei&gt; d&apos;Ä",
    );
    expect(text(xml, "kurzrubrum")).toEqual([
      "Terminumfrage zum Aktenzeichen 1 &lt;A&gt; &amp; 2/26",
    ]);
  });

  it("names sender and recipient in free text, without a court code", () => {
    const xml = ervInvitationMessage(message);

    expect(xml).toContain('<tns:nachrichtenkopf xjustizVersion="3.6.2">');
    // Sender, recipient and the authority of the case, in this order.
    expect(text(xml, "sonstige")).toEqual([
      "Verhandlungstermin-Finder",
      "Person A",
      "Verhandlungstermin-Finder",
    ]);
    expect(xml).not.toContain("<tns:gericht");
    expect(text(xml, "aktenzeichen.unbekannt")).toEqual(["true"]);
    expect(text(xml, "eigeneNachrichtenID")).toEqual([message.messageId]);
    expect(text(xml, "erstellungszeitpunkt")).toEqual(["2026-11-25T23:30:00.000Z"]);
    expect(text(xml, "nameDesProdukts")).toEqual(["Verhandlungstermin-Finder"]);
    expect(text(xml, "herstellerDesProdukts")).toEqual(["DigitalService GmbH des Bundes"]);
    expect(text(xml, "version")).toEqual(["0123abc"]);
  });

  it("names the case by its Aktenzeichen", () => {
    expect(text(ervInvitationMessage(message), "kurzrubrum")).toEqual([
      "Terminumfrage zum Aktenzeichen 574 C 7/26",
    ]);
  });

  it("carries the invitation PDF under the name the beA expects", () => {
    const xml = ervInvitationMessage(message);

    expect(text(xml, "id")).toEqual([message.documentId]);
    expect(xml).toContain(
      '<tns:dokumentklasse listVersionID="1.3"><code>001</code></tns:dokumentklasse>',
    );
    expect(text(xml, "anzeigename")).toEqual(["Nachrichtentext.pdf"]);
    expect(text(xml, "dateiname")).toEqual([ERV_INVITATION_FILE_NAME]);
    expect(xml).toContain(
      '<tns:bestandteil listVersionID="2.5"><code>001</code></tns:bestandteil>',
    );
  });

  it("is rejected by the schema when an ID is not a UUID", async () => {
    const errors = await xjustizErrors(ervInvitationMessage({ ...message, messageId: "m1" }));

    expect(errors).toEqual([expect.stringContaining("eigeneNachrichtenID")]);
  });
});
