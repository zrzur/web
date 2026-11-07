// English UI string → the same string in a locale, read from the Lingui
// catalogs of this checkout, so one script can click by visible name in en, ar
// and de.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cache = {};

function load(language) {
  if (cache[language]) return cache[language];
  const file = fileURLToPath(
    new URL(
      `../../components/i18n/catalogs/${language}/messages.po`,
      import.meta.url,
    ),
  );
  const map = new Map();
  for (const block of readFileSync(file, "utf8").split(/\r?\n\r?\n/)) {
    if (block.includes("#~ ")) continue;
    const id = block.match(/^msgid "(.*)"$/m);
    const str = block.match(/^msgstr "(.*)"$/m);
    if (id && str && str[1]) {
      map.set(id[1].replace(/\\"/g, '"'), str[1].replace(/\\"/g, '"'));
    }
  }
  return (cache[language] = map);
}

/** The visible text of an English UI string in this locale */
export function tr(locale, english) {
  const language = locale.slice(0, 2);
  if (language === "en") return english;
  const text = load(language).get(english);
  // A missing string means an untranslated UI string: fail loudly, never guess.
  if (text === undefined) {
    throw new Error(`no ${language} text for "${english}"`);
  }
  return text;
}
