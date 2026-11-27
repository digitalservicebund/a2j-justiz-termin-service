// Downloads a version of the XJustiz code list GDS.Gerichte into app/core/domain/court/, unchanged.
// Usage: pnpm courts:update --version 3.8
// Afterwards, point the import in app/core/domain/court/court.ts to the new file, delete the old
// one, and review the diff: a court that was closed keeps its code with the prefix "aufgelöst-".
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { log } from "../app/lib/infra/logging.ts";

try {
  const { values } = parseArgs({ options: { version: { type: "string" } } });
  const version = values.version ?? "";
  if (!/^\d+\.\d+$/.test(version)) throw new Error(`invalid version "${version}"`);

  const urn = `urn:xoev-de:xjustiz:codeliste:gds.gerichte_${version}`;
  const url = `https://www.xrepository.de/api/xrepository/${urn}/download/GDS.Gerichte_${version}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed with status ${response.status}`);

  const text = await response.text();
  const parsed = JSON.parse(text) as { metadaten?: { kennung?: string }; daten?: unknown };
  if (parsed.metadaten?.kennung !== urn || !Array.isArray(parsed.daten)) {
    throw new Error("the download is not the expected code list");
  }

  const target = new URL(`../app/core/domain/court/GDS.Gerichte_${version}.json`, import.meta.url);
  await writeFile(target, text);
  log.info({ version, entries: parsed.daten.length }, "court code list downloaded");
} catch (error) {
  log.error(
    { err: error },
    "could not update the court code list; usage: pnpm courts:update --version <version>",
  );
  process.exitCode = 1;
}
