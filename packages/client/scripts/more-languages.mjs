// French, Spanish, Russian and Simplified Chinese text for the app, next to
// zrzur-translations.mjs (Arabic and German).
//   node scripts/more-languages.mjs list    the English strings with no text in one of the four
//   node scripts/more-languages.mjs         write scripts/i18n/more-*.json into the four catalogs
// Run `pnpm exec lingui extract --locale <fr|es|ru|zh-Hans>` first (one locale a run, never
// --clean). A file is `"English": ["French", "Spanish", "Russian", "Chinese"]`; a string whose
// context differs is keyed `context\u0004English`. Only empty entries are filled: text a person
// wrote in a catalog is never replaced. Exits 1 while any string is still empty.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const LOCALES = ["fr", "es", "ru", "zh-Hans"];
const file = (locale) => `components/i18n/catalogs/${locale}/messages.po`;
const quoted = (lines) =>
  lines.map((line) => JSON.parse(line.slice(line.indexOf('"')))).join("");

/** The entries of a catalog, each with the lines it is made of */
function entries(locale) {
  const blocks = readFileSync(file(locale), "utf8").split(/\r?\n\r?\n/);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const at = (field) =>
      lines.findIndex((line) => line.startsWith(`${field} `));
    const run = (from) => {
      if (from < 0) return [];
      let to = from + 1;
      while (to < lines.length && lines[to].startsWith('"')) to++;
      return lines.slice(from, to);
    };
    const obsolete = lines.some((line) => line.startsWith("#~"));
    const id = quoted(run(at("msgid")));
    const context = at("msgctxt") < 0 ? "" : quoted(run(at("msgctxt")));
    const strAt = at("msgstr");
    return { lines, obsolete, id, context, strAt, text: quoted(run(strAt)) };
  });
}

const texts = {};
for (const name of readdirSync("scripts/i18n").sort())
  if (/^more-.*\.json$/.test(name))
    Object.assign(
      texts,
      JSON.parse(readFileSync(`scripts/i18n/${name}`, "utf8")),
    );

if (process.argv[2] === "list") {
  const missing = new Map();
  for (const locale of LOCALES)
    for (const entry of entries(locale))
      if (!entry.obsolete && entry.id && !entry.text)
        missing.set(
          entry.context ? `${entry.context}\u0004${entry.id}` : entry.id,
          true,
        );
  console.log(JSON.stringify([...missing.keys()], null, 1));
  process.exit(0);
}

let left = 0;
for (const [index, locale] of LOCALES.entries()) {
  const all = entries(locale);
  let filled = 0;
  for (const entry of all) {
    if (entry.obsolete || !entry.id || entry.text) continue;
    const found =
      texts[entry.context ? `${entry.context}\u0004${entry.id}` : entry.id];
    const text = found?.[index];
    if (!text) {
      left++;
      continue;
    }
    // placeholders must come through unchanged, or the app would show them raw
    const marks = (value) =>
      (value.match(/\{[^{}\s,]+\}|<\/?\d+\/?>/g) ?? []).sort().join(" ");
    if (!/plural|select/.test(entry.id) && marks(entry.id) !== marks(text))
      throw new Error(
        `${locale}: placeholders differ in "${entry.id}" -> "${text}"`,
      );
    let to = entry.strAt + 1;
    while (to < entry.lines.length && entry.lines[to].startsWith('"')) to++;
    entry.lines.splice(
      entry.strAt,
      to - entry.strAt,
      `msgstr ${JSON.stringify(text)}`,
    );
    filled++;
  }
  writeFileSync(
    file(locale),
    all.map((entry) => entry.lines.join("\n")).join("\n\n"),
  );
  console.log(`${locale}: filled ${filled}`);
}
console.log(`still empty: ${left}`);
process.exit(left ? 1 : 0);
