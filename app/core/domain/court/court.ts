// The courts of the XJustiz code list GDS.Gerichte. The file is committed as published at
// https://www.xrepository.de/details/urn:xoev-de:xjustiz:codeliste:gds.gerichte_3.7 and updated
// with scripts/update-court-codelist.ts. The database stores the code; the name is looked up here.
import codeList from "./GDS.Gerichte_3.7.json";

type Court = { code: string; name: string };

// The courts of one Bundesland, or of the Bund, as one group of the dropdown.
export type CourtGroup = { label: string; courts: Court[] };

// The list keeps a court that was closed, with this prefix, so a stored code always has a name.
const DISSOLVED_PREFIX = "aufgelöst-";
const TEST_PREFIX = "ZZ Test";

// The last letter of a code says what kind of office it is. Judges do not hold hearings at a
// Staatsanwaltschaft or a Grundbuchamt.
const NOT_A_COURT = new Set(["S", "G"]);

// The first letter of a code says which Bundesland the office belongs to.
const REGIONS: Record<string, string> = {
  A: "Bund",
  Z: "Bund",
  B: "Baden-Württemberg",
  C: "Europäische Union",
  D: "Bayern",
  F: "Berlin",
  G: "Brandenburg",
  H: "Bremen",
  K: "Hamburg",
  M: "Hessen",
  N: "Mecklenburg-Vorpommern",
  P: "Niedersachsen",
  R: "Nordrhein-Westfalen",
  T: "Rheinland-Pfalz",
  U: "Sachsen",
  V: "Saarland",
  W: "Sachsen-Anhalt",
  X: "Schleswig-Holstein",
  Y: "Thüringen",
};
const OTHER_REGION = "Sonstige";

const compareGerman = (a: string, b: string) => a.localeCompare(b, "de");

const names = new Map<string, string>(
  codeList.daten.map(([code = "", name = ""]) => [code, name] as const),
);

const isPickable = (code: string, name: string) =>
  !name.startsWith(DISSOLVED_PREFIX) &&
  !name.startsWith(TEST_PREFIX) &&
  !NOT_A_COURT.has(code.slice(-1));

const pickable = new Map([...names].filter(([code, name]) => isPickable(code, name)));

// Whether a judge may choose the court: it exists, is still open, and is a court.
export function isPickableCourt(code: string): boolean {
  return pickable.has(code);
}

// The name to show for a stored code. A closed court keeps its name without the prefix, and a code
// the list does not know is shown as it is. No code means no court.
export function courtName(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const name = names.get(code);
  if (name === undefined) return code;
  return name.startsWith(DISSOLVED_PREFIX) ? name.slice(DISSOLVED_PREFIX.length) : name;
}

// The Bund comes first, then the Länder by name, and anything unknown last.
const rank = (label: string) => (label === "Bund" ? 0 : label === OTHER_REGION ? 2 : 1);

function groupCourts(): CourtGroup[] {
  const groups = new Map<string, Court[]>();
  for (const [code, name] of pickable) {
    const label = REGIONS[code.charAt(0)] ?? OTHER_REGION;
    const courts = groups.get(label) ?? [];
    courts.push({ code, name });
    groups.set(label, courts);
  }
  return [...groups]
    .map(([label, courts]) => ({
      label,
      courts: courts.sort((a, b) => compareGerman(a.name, b.name)),
    }))
    .sort((a, b) => rank(a.label) - rank(b.label) || compareGerman(a.label, b.label));
}

// The courts a judge can choose, grouped for the dropdown.
export const courtGroups: readonly CourtGroup[] = groupCourts();
