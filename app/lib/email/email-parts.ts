import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import html from "html-template-tag";

import {
  contactLinks,
  operatorLinks,
  pilotLinks,
  TODO_HREF,
  type Link,
} from "../../components/shared/footer-links.ts";

export const PRODUCT_NAME = "Verhandlungstermin-Finder";
const PRODUCT_TAGLINE = "Onlinedienste der Justiz";
const LOGO_CID = "bmjv-logo@justiz-termin-service";
// bmjv-logo.png is flattened onto white: clients that darken the page (Gmail, Outlook.com) leave
// images alone, so the black lettering would otherwise vanish on a dark background.
// Resolved from the working directory (the project root for the server, the Docker image, tests and
// batch jobs), because import.meta.url points into build/server/ once the app is bundled.
const LOGO_PATH = resolve("app/lib/email/bmjv-logo.png");
let logoPng: Buffer | undefined;
const LOGO_ALT = "Bundesministerium der Justiz und für Verbraucherschutz";
const ADDRESS =
  "DigitalService GmbH des Bundes, Prinzessinnenstraße 8-14, 10969 Berlin, Berlin, Deutschland.";

// KERN colours, written out because mail clients do not support CSS variables.
export const COLOR = {
  text: "#131525",
  muted: "#51577a",
  action: "#2044aa",
  border: "#c0c3d5",
  white: "#ffffff",
};

// Mail clients without webfont support (Gmail, Outlook) would fall back to an arbitrary font.
export const FONT = "Arial, Helvetica, sans-serif";

// Links without a target yet (placeholders in the page footer) are useless in a mail.
const hasTarget = ({ href }: Link) => href !== TODO_HREF;

export const textStyle = (size: number, lineHeight: number, color: string, bold = false) =>
  `margin:0;font-family:${FONT};font-size:${size}px;line-height:${lineHeight}px;color:${color};${bold ? "font-weight:bold;" : ""}`;

// The `html` tag escapes every `${}` and returns plain strings, so a component's result must go into
// its parent through `$${}` (no second escaping). It also drops `${}` in URI attributes such as
// href and style; those take `$${}`, with `escaped` for values that are not constants.
export const escaped = (value: string) => html`${value}`;

export function Anchor(link: Link, size: number) {
  return html`<a
    href="$${escaped(link.href)}"
    style="color:${COLOR.action};text-decoration:underline;font-family:${FONT};font-size:${String(size)}px;line-height:24px;"
    >${link.label}</a
  >`;
}

type TextRowProps = {
  children: string;
  padding: string;
  size: number;
  color: string;
  lineHeight?: number;
  bold?: boolean;
};

export function TextRow({ children, padding, size, color, lineHeight = 24, bold }: TextRowProps) {
  return html`<tr>
    <td style="padding:${padding};$${textStyle(size, lineHeight, color, bold)}">$${children}</td>
  </tr>`;
}

export function Divider(padding: string) {
  return html`<tr>
    <td style="padding:${padding};border-top:1px solid ${COLOR.border};font-size:0;line-height:0;">
      &nbsp;
    </td>
  </tr>`;
}

// Hidden text that mail clients show next to the subject in the inbox list.
function Preheader(text: string) {
  return html`<div
    style="display:none;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.white};"
  >
    ${text}$${"&nbsp;&zwnj;".repeat(40)}
  </div>`;
}

export function Header() {
  return html`<tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="stack" valign="top" style="padding:0 0 16px 0;">
            <p style="$${textStyle(26, 32, COLOR.text, true)}">${PRODUCT_NAME}</p>
            <p style="$${textStyle(21, 32, COLOR.muted)}">${PRODUCT_TAGLINE}</p>
          </td>
          <td
            class="stack stack-logo"
            valign="top"
            align="right"
            width="181"
            style="padding:0 0 16px 0;"
          >
            <img
              src="cid:${LOGO_CID}"
              width="181"
              height="99"
              border="0"
              alt="${LOGO_ALT}"
              style="display:block;width:181px;height:99px;font-family:${FONT};font-size:14px;line-height:18px;color:${COLOR.text};"
            />
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function Button(label: string, url: string) {
  return html`<tr>
    <td style="padding:0 0 16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td
            align="center"
            bgcolor="${COLOR.action}"
            style="background-color:${COLOR.action};border-radius:4px;mso-padding-alt:12px 24px 12px 24px;"
          >
            <a
              href="$${escaped(url)}"
              style="display:inline-block;padding:12px 24px 12px 24px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:bold;color:${COLOR.white};text-decoration:none;"
              >${label}&nbsp;&nbsp;&rarr;</a
            >
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function ContactRows(links: Link[]) {
  return html`$${TextRow({ children: "Kontakt und Teilnahme", padding: "0 0 4px 0", size: 18, color: COLOR.text, bold: true })}
    <tr>
      <td style="padding:0 0 24px 0;">
        $${links.map((link) => Anchor(link, 18)).join("&nbsp;&nbsp;&nbsp; ")}
      </td>
    </tr>`;
}

export function Footer() {
  const contact = contactLinks.filter(hasTarget);
  const pilot = pilotLinks[0]!;
  const operator = operatorLinks[0]!;
  const muted = { color: COLOR.muted, size: 18 };

  return html`$${contact.length === 0 ? "" : ContactRows(contact)}
  $${TextRow({ children: "Impressum", padding: "0 0 4px 0", size: 18, color: COLOR.text, bold: true })}
  $${TextRow({ ...muted, padding: "0 0 12px 0", children: html`Ein Pilotprojekt des $${Anchor(pilot, 18)}.` })}
  $${TextRow({ ...muted, padding: "0 0 12px 0", children: html`Umsetzung und Betrieb durch $${Anchor(operator, 18)}.` })}
  $${TextRow({ children: html`${ADDRESS}`, padding: "0", size: 16, color: COLOR.muted })}`;
}

export function Layout(
  { subject, preheader }: { subject: string; preheader: string },
  children: string,
) {
  return html`<!DOCTYPE html>
    <html
      lang="de"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
    >
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta
          name="format-detection"
          content="telephone=no, date=no, address=no, email=no, url=no"
        />
        <title>${subject}</title>
        <!--[if mso]>
          <noscript
            ><xml
              ><o:OfficeDocumentSettings
                ><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings
              ></xml
            ></noscript
          >
        <![endif]-->
        <style>
          @media only screen and (max-width: 480px) {
            .stack {
              display: block !important;
              width: 100% !important;
            }
            .stack-logo {
              padding: 16px 0 0 0 !important;
              text-align: left !important;
            }
            .gutter {
              padding-left: 16px !important;
              padding-right: 16px !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:${COLOR.white};">
        $${Preheader(preheader)}
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          bgcolor="${COLOR.white}"
          style="background-color:${COLOR.white};"
        >
          <tr>
            <td align="center" class="gutter" style="padding:24px 24px 24px 24px;">
              <!--[if mso]><table role="presentation" width="608" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="max-width:608px;"
              >
                $${children}
              </table>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>
        </table>
      </body>
    </html>`;
}

export function renderFooterText() {
  const contact = contactLinks.filter(hasTarget);
  const pilot = pilotLinks[0]!;
  const operator = operatorLinks[0]!;

  return [
    ...(contact.length > 0
      ? ["Kontakt und Teilnahme", ...contact.map(({ label, href }) => `${label}: ${href}`), ""]
      : []),
    "Impressum",
    `Ein Pilotprojekt des ${pilot.label} (${pilot.href}).`,
    `Umsetzung und Betrieb durch ${operator.label} (${operator.href}).`,
    ADDRESS,
  ];
}

export function renderHeaderText() {
  return [PRODUCT_NAME, PRODUCT_TAGLINE];
}

export function logoAttachment() {
  return {
    filename: "bmjv-logo.png",
    content: (logoPng ??= readFileSync(LOGO_PATH)),
    contentType: "image/png",
    cid: LOGO_CID,
    contentDisposition: "inline" as const,
  };
}
