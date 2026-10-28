import {
  contactLinks,
  operatorLinks,
  pilotLinks,
  TODO_HREF,
  type Link,
} from "../../components/shared/footer-links.ts";
import LOGO_DATA_URI from "./bmjv-logo.png?inline";

export type MagicLinkVariant = "signup" | "login";

const PRODUCT_NAME = "Verhandlungstermin-Finder";
const PRODUCT_TAGLINE = "Onlinedienste der Justiz";
const LOGO_CID = "bmjv-logo@justiz-termin-service";
// bmjv-logo.png is flattened onto white: clients that darken the page (Gmail, Outlook.com) leave
// images alone, so the black lettering would otherwise vanish on a dark background.
const LOGO_ALT = "Bundesministerium der Justiz und für Verbraucherschutz";
const ADDRESS =
  "DigitalService GmbH des Bundes, Prinzessinnenstraße 8-14, 10969 Berlin, Berlin, Deutschland.";
const VALIDITY = "Der Link ist 5 Minuten gültig und kann nur einmal verwendet werden.";

const COPY = {
  signup: {
    subject: "Verifizieren Sie Ihre E-Mail-Adresse",
    heading: `Verifizieren Sie Ihre E-Mail-Adresse, um ein Konto beim ${PRODUCT_NAME} zu erstellen.`,
    button: "E-Mail-Adresse verifizieren",
    ignore: "Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie einfach ignorieren.",
  },
  login: {
    subject: `Anmelden beim ${PRODUCT_NAME}`,
    heading: `Melden Sie sich beim ${PRODUCT_NAME} an.`,
    button: "Anmelden",
    ignore:
      "Wenn Sie diese Anmeldung nicht angefordert haben, können Sie diese E-Mail einfach ignorieren.",
  },
} satisfies Record<MagicLinkVariant, Record<string, string>>;

// KERN colours, written out because mail clients do not support CSS variables.
const COLOR = {
  text: "#131525",
  muted: "#51577a",
  action: "#2044aa",
  border: "#c0c3d5",
  white: "#ffffff",
};

// Mail clients without webfont support (Gmail, Outlook) would fall back to an arbitrary font.
const FONT = "Arial, Helvetica, sans-serif";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Links without a target yet (placeholders in the page footer) are useless in a mail.
const hasTarget = ({ href }: Link) => href !== TODO_HREF;

const textStyle = (size: number, lineHeight: number, color: string, bold = false) =>
  `margin:0;font-family:${FONT};font-size:${size}px;line-height:${lineHeight}px;color:${color};${bold ? "font-weight:bold;" : ""}`;

function anchor(link: Link, size: number) {
  return `<a href="${escapeHtml(link.href)}" style="color:${COLOR.action};text-decoration:underline;font-family:${FONT};font-size:${size}px;line-height:24px;">${escapeHtml(link.label)}</a>`;
}

function renderHtml(url: string, copy: (typeof COPY)[MagicLinkVariant]) {
  const href = escapeHtml(url);
  const contact = contactLinks.filter(hasTarget);
  const pilot = pilotLinks[0]!;
  const operator = operatorLinks[0]!;

  const contactBlock =
    contact.length === 0
      ? ""
      : `<tr><td style="padding:0 0 4px 0;${textStyle(18, 24, COLOR.text, true)}">Kontakt und Teilnahme</td></tr>
<tr><td style="padding:0 0 24px 0;">${contact.map((link) => anchor(link, 18)).join("&nbsp;&nbsp;&nbsp; ")}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>${escapeHtml(copy.subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @media only screen and (max-width: 480px) {
    .stack { display: block !important; width: 100% !important; }
    .stack-logo { padding: 16px 0 0 0 !important; text-align: left !important; }
    .gutter { padding-left: 16px !important; padding-right: 16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.white};">
<div style="display:none;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.white};">${escapeHtml(copy.heading)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.white}" style="background-color:${COLOR.white};">
<tr><td align="center" class="gutter" style="padding:24px 24px 24px 24px;">
<!--[if mso]><table role="presentation" width="608" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:608px;">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="stack" valign="top" style="padding:0 0 16px 0;">
<p style="${textStyle(26, 32, COLOR.text, true)}">${PRODUCT_NAME}</p>
<p style="${textStyle(21, 32, COLOR.muted)}">${PRODUCT_TAGLINE}</p>
</td>
<td class="stack stack-logo" valign="top" align="right" width="181" style="padding:0 0 16px 0;">
<img src="cid:${LOGO_CID}" width="181" height="99" border="0" alt="${escapeHtml(LOGO_ALT)}" style="display:block;width:181px;height:99px;font-family:${FONT};font-size:14px;line-height:18px;color:${COLOR.text};">
</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:0 0 40px 0;border-top:1px solid ${COLOR.border};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 16px 0;${textStyle(21, 24, COLOR.text, true)}">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="padding:0 0 16px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="${COLOR.action}" style="background-color:${COLOR.action};border-radius:4px;mso-padding-alt:12px 24px 12px 24px;">
<a href="${href}" style="display:inline-block;padding:12px 24px 12px 24px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:bold;color:${COLOR.white};text-decoration:none;">${escapeHtml(copy.button)}&nbsp;&nbsp;&rarr;</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 0 8px 0;${textStyle(18, 24, COLOR.muted)}">${VALIDITY}</td></tr>
<tr><td style="padding:0 0 32px 0;${textStyle(18, 24, COLOR.muted)}">${escapeHtml(copy.ignore)}</td></tr>
<tr><td style="padding:0 0 24px 0;border-top:1px solid ${COLOR.border};font-size:0;line-height:0;">&nbsp;</td></tr>
${contactBlock}
<tr><td style="padding:0 0 4px 0;${textStyle(18, 24, COLOR.text, true)}">Impressum</td></tr>
<tr><td style="padding:0 0 12px 0;${textStyle(18, 24, COLOR.muted)}">Ein Pilotprojekt des ${anchor(pilot, 18)}.</td></tr>
<tr><td style="padding:0 0 12px 0;${textStyle(18, 24, COLOR.muted)}">Umsetzung und Betrieb durch ${anchor(operator, 18)}.</td></tr>
<tr><td style="${textStyle(16, 24, COLOR.muted)}">${ADDRESS}</td></tr>
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function renderText(url: string, copy: (typeof COPY)[MagicLinkVariant]) {
  const contact = contactLinks.filter(hasTarget);
  const pilot = pilotLinks[0]!;
  const operator = operatorLinks[0]!;

  return [
    PRODUCT_NAME,
    PRODUCT_TAGLINE,
    "",
    copy.heading,
    "",
    `${copy.button}:`,
    url,
    "",
    VALIDITY,
    copy.ignore,
    "",
    "--",
    ...(contact.length > 0
      ? ["Kontakt und Teilnahme", ...contact.map(({ label, href }) => `${label}: ${href}`), ""]
      : []),
    "Impressum",
    `Ein Pilotprojekt des ${pilot.label} (${pilot.href}).`,
    `Umsetzung und Betrieb durch ${operator.label} (${operator.href}).`,
    ADDRESS,
    "",
  ].join("\n");
}

export function renderMagicLinkEmail(variant: MagicLinkVariant, url: string) {
  const copy = COPY[variant];
  return {
    subject: copy.subject,
    text: renderText(url, copy),
    html: renderHtml(url, copy),
    attachments: [
      {
        filename: "bmjv-logo.png",
        path: LOGO_DATA_URI,
        contentType: "image/png",
        cid: LOGO_CID,
        contentDisposition: "inline" as const,
      },
    ],
  };
}
