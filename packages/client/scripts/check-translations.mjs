// Fails when an English string has no Arabic or German text.
// Reads the committed catalogs; obsolete entries (#~) do not count.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = (locale) =>
  join(root, "components", "i18n", "catalogs", locale, "messages.po");

function parse(locale) {
  const entries = new Map();
  let id = null;
  let text = null;
  let field = null;
  const flush = () => {
    if (id) entries.set(id, text ?? "");
    id = null;
    text = null;
    field = null;
  };
  const unquote = (line) => JSON.parse(line.slice(line.indexOf('"')));
  for (const line of readFileSync(catalog(locale), "utf8").split(/\r?\n/)) {
    if (line.startsWith("msgid ")) {
      flush();
      id = unquote(line);
      field = "id";
    } else if (line.startsWith("msgstr ")) {
      text = unquote(line);
      field = "str";
    } else if (line.startsWith('"')) {
      if (field === "id") id += unquote(line);
      if (field === "str") text += unquote(line);
    } else if (line === "") {
      flush();
    }
  }
  flush();
  return entries;
}

const english = parse("en");
let failed = 0;
for (const locale of ["ar", "de"]) {
  const target = parse(locale);
  const missing = [...english.keys()].filter((id) => !target.get(id)?.trim());
  console.log(`${locale}: ${english.size - missing.length} of ${english.size}`);
  for (const id of missing.slice(0, 20)) console.log(`  missing: ${id}`);
  if (missing.length > 20) console.log(`  and ${missing.length - 20} more`);
  failed += missing.length;
}
process.exit(failed ? 1 : 0);
