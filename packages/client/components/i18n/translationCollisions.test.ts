import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A new translations file must never change what an existing string means.
 * `scripts/zrzur-translations.mjs` writes every entry into the catalogs, so
 * a key that another file already translates would be overwritten wherever
 * that string is used: "{0} left" once turned a notification ("… ist
 * gegangen") into a timer ("noch …"), and "Game" lost its Arabic article.
 *
 * Rule for dated files (`ui-YYYYMMDDNN.json`) from 2026-11-22 on: they add
 * only strings no other translation file defines. A string with a new
 * meaning needs its own msgid or a Lingui context.
 */

const dir = join(__dirname, "../../scripts/i18n");
const FIRST_CHECKED = 2026112201;

const dated = (file: string) =>
  Number(/^ui-(\d{10})\.json$/.exec(file)?.[1] ?? 0);

function keys(file: string): string[] {
  const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? Object.keys(data)
    : [];
}

function catalog(lang: "ar" | "de") {
  const po = readFileSync(
    join(__dirname, `catalogs/${lang}/messages.po`),
    "utf8",
  );
  const map = new Map<string, string>();
  for (const block of po.split(/\r?\n\r?\n/)) {
    if (block.includes("#~ ")) continue;
    // a string with a context is keyed "context::text", as in the json files
    const context = /^msgctxt "(.*)"$/m.exec(block)?.[1];
    const id = /^msgid "(.*)"$/m.exec(block)?.[1];
    const str = /^msgstr "(.*)"$/m.exec(block)?.[1];
    const key =
      id === undefined ? undefined : context ? `${context}::${id}` : id;
    if (key !== undefined && str)
      map.set(key.replace(/\\"/g, '"'), str.replace(/\\"/g, '"'));
  }
  return map;
}

describe("translation files", () => {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const checked = files.filter((file) => dated(file) >= FIRST_CHECKED);

  it("has dated files to check", () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  for (const file of checked) {
    it(`${file} adds only new strings (no existing meaning changes)`, () => {
      const elsewhere = new Map<string, string>();
      for (const other of files) {
        if (other === file) continue;
        for (const key of keys(other))
          if (!elsewhere.has(key)) elsewhere.set(key, other);
      }
      const clashes = keys(file)
        .filter((key) => elsewhere.has(key))
        .map((key) => `"${key}" is already in ${elsewhere.get(key)}`);
      expect(clashes).toEqual([]);
    });
  }

  it("the catalogs say what the newest files say", () => {
    const ar = catalog("ar");
    const de = catalog("de");
    const problems: string[] = [];
    for (const file of checked) {
      const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<
        string,
        [string, string]
      >;
      for (const [key, [arText, deText]] of Object.entries(data)) {
        if (ar.get(key) !== arText) problems.push(`ar ${key}`);
        if (de.get(key) !== deText) problems.push(`de ${key}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
