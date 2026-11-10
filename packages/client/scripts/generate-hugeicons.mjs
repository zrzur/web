/**
 * Generate the app's icon set from Hugeicons free "Stroke Rounded" (MIT).
 *
 * Usage: node scripts/generate-hugeicons.mjs <path to @hugeicons/core-free-icons package>
 *
 * The package is only read as data (its ESM icon files are parsed as text,
 * never imported), so it does not need to be a project dependency. Writes
 * components/ui/icons/hugeicons/<name>.svg plus LICENSE.md, then rebuilds
 * components/ui/icons/drawings.ts from them (scripts/icon-drawings.mjs).
 * Stroke width is left to CSS (icon.css) so Appearance styles can change
 * the weight.
 */
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { hugeiconsMap } from "./hugeicons-map.mjs";
import {
  buildDrawings,
  checkElement,
  renderDrawings,
} from "./icon-drawings.mjs";

const pkg = process.argv[2];
if (!pkg) {
  console.error("usage: node scripts/generate-hugeicons.mjs <package dir>");
  process.exit(1);
}

const iconsDir = new URL("../components/ui/icons/", import.meta.url);
const outDir = new URL("hugeicons/", iconsDir);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Shapes that enclose an area (every subpath closed, or a circle/rect/
 * ellipse) get class "z-shape", so the Filled / Expressive styles can tint
 * them without filling open strokes.
 */
function isClosed(tag, attrs) {
  if (["circle", "rect", "ellipse"].includes(tag)) return true;
  const d = attrs.d;
  if (tag !== "path" || !d) return false;
  const subpaths = d.split(/(?=[Mm])/).filter((s) => s.trim());
  return subpaths.every((s) => /[Zz]\s*$/.test(s.trim()));
}

function toSvg(source) {
  const elements = [...source.matchAll(/\["(\w+)",\s*\{(.*?)\}\]/gs)].map(
    ([, tag, body]) => {
      const pairs = [...body.matchAll(/(\w+):\s*"([^"]*)"/g)].filter(
        ([, key]) => key !== "key" && key !== "strokeWidth",
      );
      const values = Object.fromEntries(pairs.map(([, k, v]) => [k, v]));
      // shapes only: anything that runs, links or loads stops the run
      checkElement(
        tag,
        Object.fromEntries(pairs.map(([, k, v]) => [kebab(k), v])),
        source.slice(0, 40),
      );
      const attrs = pairs.map(([, key, value]) => `${kebab(key)}="${value}"`);
      // Solid dots already carry their own fill
      if (isClosed(tag, values) && !values.fill) attrs.push('class="z-shape"');
      return `<${tag} ${attrs.join(" ")}/>`;
    },
  );
  if (!elements.length) throw new Error("no elements");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">${elements.join("")}</svg>\n`;
}

let count = 0;
for (const [key, name] of Object.entries(hugeiconsMap)) {
  const source = readFileSync(join(pkg, "dist", "esm", `${name}.js`), "utf8");
  writeFileSync(new URL(`${key}.svg`, outDir), toSvg(source));
  count++;
}

copyFileSync(join(pkg, "LICENSE.md"), new URL("LICENSE.md", outDir));

// the registry draws markup strings, not one component per file
writeFileSync(
  new URL("drawings.ts", iconsDir),
  await renderDrawings(await buildDrawings()),
);

console.log(`wrote ${count} icons`);
