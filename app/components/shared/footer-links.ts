// Shared by the page footer and the e-mail footer.
// Targets for these links are not defined in the design yet.
export const TODO_HREF = "#";

export type Link = { href: string; label: string };

export const legalLinks: Link[] = [
  { href: TODO_HREF, label: "Impressum" },
  { href: TODO_HREF, label: "Barrierefreiheit" },
  { href: TODO_HREF, label: "Datenschutz" },
];

export const contactLinks: Link[] = [
  { href: TODO_HREF, label: "Kontakt" },
  {
    href: "https://github.com/digitalservicebund/a2j-justiz-termin-service",
    label: "Open Source Code",
  },
  { href: TODO_HREF, label: "An Befragungen teilnehmen" },
];

export const pilotLinks: Link[] = [
  {
    href: "https://www.bmj.de",
    label: "Bundesministeriums der Justiz und für Verbraucherschutz",
  },
];

export const operatorLinks: Link[] = [
  {
    href: "https://digitalservice.bund.de",
    label: "DigitalService GmbH des Bundes",
  },
  {
    href: "https://zugang-zum-recht-projekte.de",
    label: "zugang-zum-recht-projekte.de",
  },
];
