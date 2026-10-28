import html from "html-template-tag";

import {
  Button,
  Divider,
  Footer,
  Header,
  Layout,
  COLOR,
  PRODUCT_NAME,
  TextRow,
  logoAttachment,
  renderFooterText,
  renderHeaderText,
} from "./email-parts.ts";

export type MagicLinkVariant = "signup" | "login";

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

type Copy = (typeof COPY)[MagicLinkVariant];

function Content(url: string, copy: Copy) {
  return html`<tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        $${TextRow({ children: html`${copy.heading}`, padding: "0 0 16px 0", size: 21, color: COLOR.text, bold: true })}
        $${Button(copy.button, url)}
        $${TextRow({ children: html`${VALIDITY}`, padding: "0 0 8px 0", size: 18, color: COLOR.muted })}
        $${TextRow({ children: html`${copy.ignore}`, padding: "0 0 32px 0", size: 18, color: COLOR.muted })}
        $${Divider("0 0 24px 0")} $${Footer()}
      </table>
    </td>
  </tr>`;
}

function renderHtml(url: string, copy: Copy) {
  return Layout(
    { subject: copy.subject, preheader: copy.heading },
    html`$${Header()} $${Divider("0 0 40px 0")} $${Content(url, copy)}`,
  );
}

function renderText(url: string, copy: Copy) {
  return [
    ...renderHeaderText(),
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
    ...renderFooterText(),
    "",
  ].join("\n");
}

export function renderMagicLinkEmail(variant: MagicLinkVariant, url: string) {
  const copy = COPY[variant];
  return {
    subject: copy.subject,
    text: renderText(url, copy),
    html: renderHtml(url, copy),
    attachments: [logoAttachment()],
  };
}
