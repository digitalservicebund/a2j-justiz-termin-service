import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { validateXML } from "xmllint-wasm";

// The XSDs of XJustiz 3.6.2 that a nachricht.gds.* message needs, as published on
// https://xjustiz.justiz.de (XJustiz-Versionen). Only the files the message schema includes.
const SCHEMA_DIR = path.join(import.meta.dirname, "xjustiz", "3.6.2");
const MESSAGE_SCHEMA = "xjustiz_0005_nachrichten_3_2.xsd";

const schemaFiles = () =>
  readdirSync(SCHEMA_DIR)
    .filter((fileName) => fileName.endsWith(".xsd"))
    .map((fileName) => ({
      fileName,
      contents: readFileSync(path.join(SCHEMA_DIR, fileName), "utf8"),
    }));

// Validates an XJustiz message against the schema. Returns the errors xmllint found, none if valid.
export async function xjustizErrors(xml: string): Promise<string[]> {
  const files = schemaFiles();
  const result = await validateXML({
    xml: { fileName: "message.xml", contents: xml },
    schema: files.find(({ fileName }) => fileName === MESSAGE_SCHEMA)!,
    preload: files.filter(({ fileName }) => fileName !== MESSAGE_SCHEMA),
  });
  return result.errors.map(({ rawMessage }) => rawMessage);
}
