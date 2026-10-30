// Shared by the page footer and the e-mail footer.

export type Link = { href: string; label: string };

export const legalLinks: Link[] = [
  { href: "https://service.justiz.de/impressum", label: "Impressum" },
  { href: "https://service.justiz.de/barrierefreiheit", label: "Barrierefreiheit" },
  { href: "https://service.justiz.de/datenschutzerklaerung", label: "Datenschutz" },
];

export const contactLinks: Link[] = [
  { href: "https://service.justiz.de/kontakt", label: "Kontakt" },
  {
    href: "https://github.com/digitalservicebund/a2j-justiz-termin-service",
    label: "Open Source Code",
  },
  { href: "https://service.justiz.de/feedback", label: "An Befragungen teilnehmen" },
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
