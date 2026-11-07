import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(
  "components/i18n/catalogs/ar/messages.po",
  "utf8",
).replace(/\r\n/g, "\n");

function decode(chunk) {
  return [...chunk.matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((m) => m[1])
    .join("")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const missing = [];
for (const block of src.split(/\n\s*\n/)) {
  if (/^#~/m.test(block)) continue;
  const id = block.match(/^msgid ((?:"(?:\\.|[^"\\])*"\n?)+)/m);
  const str = block.match(/^msgstr ((?:"(?:\\.|[^"\\])*"\n?)+)/m);
  if (!id || !str) continue;
  const msgid = decode(id[1]);
  const msgstr = decode(str[1]);
  if (!msgid || msgstr) continue;
  const origin = block.match(/^#: (.+)$/m)?.[1] ?? "";
  missing.push({ origin, msgid });
}

writeFileSync(
  "scripts/missing-ar.json",
  JSON.stringify(missing, null, 2),
);
console.log("missing", missing.length);
