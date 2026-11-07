import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "components"];
const skip = /node_modules|catalogs[\\/]|coverage\.ts|Languages\.ts|\.test\.|\.stories\./;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (skip.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(p);
  }
}

const files = [];
for (const root of roots) walk(root, files);

const hits = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (/<(Trans|Plural|Select)\b/.test(line)) continue;
    if (/\bt`/.test(line) || /msg`/.test(line)) continue;
    const jsx = line.match(/>([A-Za-z][^<{]{2,80})</);
    const attr = line.match(
      /\b(?:placeholder|aria-label|title|label|alt|description)=["']([A-Za-z][^"']{2,80})["']/,
    );
    const found = jsx?.[1] || attr?.[1];
    if (!found) continue;
    if (/^(true|false|null|undefined|div|span|button|svg|path)$/.test(found)) continue;
    hits.push(`${file}:${i + 1}: ${found.trim()}`);
  }
}
console.log(hits.slice(0, 180).join("\n"));
console.log("---", hits.length, "hits");
