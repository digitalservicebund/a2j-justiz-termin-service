import { PRODUCT_NAME } from "../web/page-meta.ts";

// The XJustiz version the message follows, and the versions of the code lists it uses, as in the
// example message of the Basisdienst: ERV Versand team.
const XJUSTIZ_VERSION = "3.6.2";
const DOKUMENTKLASSE_LIST_VERSION = "1.3";
const BESTANDTEILTYP_LIST_VERSION = "2.5";
// GDS.Dokumentklasse "Andere / Sonstige" and GDS.Bestandteiltyp "Original".
const DOKUMENTKLASSE_SONSTIGE = "001";
const BESTANDTEIL_ORIGINAL = "001";

const SENDER = PRODUCT_NAME;
const MANUFACTURER = "DigitalService GmbH des Bundes";

// The name of the invitation PDF, as the message references it and as it is attached. The
// Basisdienst team says the beA expects exactly this name, so it does not follow the ERV pattern
// "<name>_<UUID>.<extension>".
export const ERV_INVITATION_FILE_NAME = "Nachrichtentext.pdf";

export type ErvInvitationMessage = {
  aktenzeichen: string;
  // How the recipient is addressed: the name the judge gave, or what the app shows instead.
  recipient: string;
  // UUIDs of the message and of the invitation document in it.
  messageId: string;
  documentId: string;
  // The version of the app that sends it: the commit the image was built from.
  version: string;
  now: Date;
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// The XJustiz message an ERV invitation is sent with: nachricht.gds.uebermittlungSchriftgutobjekte
// with the invitation PDF as its only document, after the example of the Basisdienst: ERV Versand
// team. Sender and recipient are named in free text, so no court code is needed. The recipient has
// no Aktenzeichen of their own; the case is named by its Aktenzeichen in the short title. The
// SAFE-ID is not repeated in the message, the ERV delivers it to that address.
//
// It is valid against the XSD of XJustiz 3.6.2. The Schematron rules of the Grunddatensatz only
// concern metadata-only and confidential documents, which this message has none of.
export function ervInvitationMessage({
  aktenzeichen,
  recipient,
  messageId,
  documentId,
  version,
  now,
}: ErvInvitationMessage): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<tns:nachricht.gds.uebermittlungSchriftgutobjekte.0005005 xmlns:tns="http://www.xjustiz.de">
  <tns:nachrichtenkopf xjustizVersion="${XJUSTIZ_VERSION}">
    <tns:erstellungszeitpunkt>${now.toISOString()}</tns:erstellungszeitpunkt>
    <tns:absender>
      <tns:informationen>
        <tns:auswahl_kommunikationspartner>
          <tns:sonstige>${escapeXml(SENDER)}</tns:sonstige>
        </tns:auswahl_kommunikationspartner>
      </tns:informationen>
      <tns:eigeneNachrichtenID>${messageId}</tns:eigeneNachrichtenID>
    </tns:absender>
    <tns:empfaenger>
      <tns:informationen>
        <tns:auswahl_kommunikationspartner>
          <tns:sonstige>${escapeXml(recipient)}</tns:sonstige>
        </tns:auswahl_kommunikationspartner>
      </tns:informationen>
      <tns:auswahl_aktenzeichen>
        <tns:aktenzeichen.unbekannt>true</tns:aktenzeichen.unbekannt>
      </tns:auswahl_aktenzeichen>
    </tns:empfaenger>
    <tns:herstellerinformation>
      <tns:nameDesProdukts>${escapeXml(PRODUCT_NAME)}</tns:nameDesProdukts>
      <tns:herstellerDesProdukts>${MANUFACTURER}</tns:herstellerDesProdukts>
      <tns:version>${escapeXml(version)}</tns:version>
    </tns:herstellerinformation>
  </tns:nachrichtenkopf>
  <tns:grunddaten>
    <tns:verfahrensdaten>
      <tns:instanzdaten>
        <tns:auswahl_instanzbehoerde>
          <tns:sonstige>${escapeXml(SENDER)}</tns:sonstige>
        </tns:auswahl_instanzbehoerde>
        <tns:kurzrubrum>Terminumfrage zum Aktenzeichen ${escapeXml(aktenzeichen)}</tns:kurzrubrum>
      </tns:instanzdaten>
    </tns:verfahrensdaten>
  </tns:grunddaten>
  <tns:schriftgutobjekte>
    <tns:dokument>
      <tns:identifikation>
        <tns:id>${documentId}</tns:id>
        <tns:nummerImUebergeordnetenContainer>1</tns:nummerImUebergeordnetenContainer>
      </tns:identifikation>
      <tns:xjustiz.fachspezifischeDaten>
        <tns:dokumentklasse listVersionID="${DOKUMENTKLASSE_LIST_VERSION}"><code>${DOKUMENTKLASSE_SONSTIGE}</code></tns:dokumentklasse>
        <tns:anzeigename>${ERV_INVITATION_FILE_NAME}</tns:anzeigename>
        <tns:datei>
          <tns:dateiname>${ERV_INVITATION_FILE_NAME}</tns:dateiname>
          <tns:bestandteil listVersionID="${BESTANDTEILTYP_LIST_VERSION}"><code>${BESTANDTEIL_ORIGINAL}</code></tns:bestandteil>
        </tns:datei>
      </tns:xjustiz.fachspezifischeDaten>
    </tns:dokument>
  </tns:schriftgutobjekte>
</tns:nachricht.gds.uebermittlungSchriftgutobjekte.0005005>
`;
}
