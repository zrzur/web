/**
 * The icon drawings as markup strings (components/ui/icons/drawings.ts).
 *
 * Every icon used to be its own Solid component (one per SVG file, through
 * vite-plugin-solid-svg): each carried its own <svg> wrapper, template and
 * component code, about 140 bytes per icon on top of the drawing. Here the
 * SVG files go through the same svgo pass the plugin uses (default preset)
 * and only the inside of each <svg> is kept; Icon.tsx draws it into one
 * shared <svg>. Same elements, same attributes, same look.
 *
 * Usage: node scripts/icon-drawings.mjs          (rewrite drawings.ts)
 *        node scripts/icon-drawings.mjs --check  (exit 1 if out of date)
 * generate-hugeicons.mjs runs it after writing the SVG files.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * packages/client; the functions take it as an argument, so tests can call
 * them from a bundle where import.meta.url is not a file
 */
const clientDir = () => join(dirname(fileURLToPath(import.meta.url)), "..");
const svgDirOf = (client) => join(client, "components/ui/icons/hugeicons");
const outFileOf = (client) => join(client, "components/ui/icons/drawings.ts");

/** svgo as vite-plugin-solid-svg has it (it is that plugin's dependency) */
async function loadSvgo(client) {
  const require = createRequire(join(client, "package.json"));
  const plugin = require.resolve("vite-plugin-solid-svg");
  const svgo = createRequire(plugin).resolve("svgo");
  return import(pathToFileURL(svgo).href);
}

/** The attributes every icon file has on its <svg>; Icon.tsx sets the same */
const ROOT = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
};

/** Attribute values that need no quotes in HTML */
const BARE = /^[\w.#-]+$/;

/**
 * What a drawing may hold: shapes and their geometry and paint, nothing
 * that runs, links or loads (no scripts, handlers, href, style, images)
 */
const ELEMENTS = new Set([
  "path",
  "circle",
  "rect",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "g",
]);
const ATTRIBUTES = new Set([
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "fill",
  "fill-rule",
  "clip-rule",
  "stroke",
  "opacity",
  "transform",
  "class",
]);
const allowedAttribute = (name) =>
  ATTRIBUTES.has(name) || /^stroke-[a-z]+(-[a-z]+)*$/.test(name);

/** Throw unless an element and its attributes are on the allowlist */
export function checkElement(tag, attrs, file = "icon") {
  if (!ELEMENTS.has(tag)) throw new Error(`${file}: <${tag}> is not allowed`);
  for (const [name, value] of Object.entries(attrs)) {
    if (!allowedAttribute(name))
      throw new Error(`${file}: <${tag} ${name}> is not allowed`);
    if (/["'<>\\]/.test(value))
      throw new Error(`${file}: <${tag} ${name}> has a quote or bracket`);
  }
}

/** key="value" pairs; anything else in the attribute text throws */
function attributes(text, where) {
  const attrs = {};
  const rest = text.replace(/\s+([\w:-]+)="([^"]*)"/g, (_all, key, value) => {
    if (Object.hasOwn(attrs, key)) throw new Error(`${where}: ${key} twice`);
    attrs[key] = value;
    return "";
  });
  if (rest.trim())
    throw new Error(`${where}: attributes not in key="value" form: ${rest}`);
  return attrs;
}

/** The inside of one optimised <svg>, with bare attribute values where safe */
export function innerMarkup(optimised, file = "icon") {
  const match = /^<svg([^>]*)>([\s\S]*)<\/svg>$/.exec(optimised.trim());
  if (!match) throw new Error(`${file}: not a single <svg> element`);
  const root = attributes(match[1], `${file} <svg>`);
  for (const [key, value] of Object.entries(root))
    if (ROOT[key] !== value)
      throw new Error(
        `${file}: <svg ${key}="${value}"> is not drawn by Icon.tsx`,
      );

  // every piece of the drawing is a tag; text, comments and the rest throw
  const inside = match[2];
  const open = [];
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/y;
  let at = 0;
  let out = "";
  while (at < inside.length) {
    tag.lastIndex = at;
    const t = tag.exec(inside);
    if (!t)
      throw new Error(`${file}: unexpected "${inside.slice(at, at + 20)}"`);
    const [all, closing, name, attrText, selfClosing] = t;
    at += all.length;
    if (closing) {
      if (attrText || selfClosing || open.pop() !== name)
        throw new Error(`${file}: </${name}> does not close an open element`);
      out += all;
      continue;
    }
    const attrs = attributes(attrText, `${file} <${name}>`);
    checkElement(name, attrs, file);
    const written = Object.entries(attrs)
      .map(([key, value]) =>
        BARE.test(value) ? `${key}=${value}` : `${key}="${value}"`,
      )
      .join(" ");
    // a bare last value would take the "/" of "/>" into itself
    const end = selfClosing ? (/"$/.test(written) ? "/>" : " />") : ">";
    out += `<${name}${written ? ` ${written}` : ""}${end}`;
    if (!selfClosing) open.push(name);
  }
  if (open.length) throw new Error(`${file}: <${open.at(-1)}> is not closed`);
  return out;
}

/** name -> inside of the <svg>, in file name order */
export async function buildDrawings(client = clientDir()) {
  const { optimize } = await loadSvgo(client);
  const svgDir = svgDirOf(client);
  const files = readdirSync(svgDir)
    .filter((f) => f.endsWith(".svg"))
    .sort();
  const out = {};
  for (const file of files) {
    const path = join(svgDir, file);
    const source = readFileSync(path, "utf8");
    const name = file.slice(0, -4);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))
      throw new Error(`${file}: icon names are lowercase words and dashes`);
    out[name] = innerMarkup(optimize(source, { path }).data, file);
  }
  return out;
}

/** drawings.ts as Prettier writes it */
export async function renderDrawings(drawings, client = clientDir()) {
  const outFile = outFileOf(client);
  const lines = Object.entries(drawings).map(([name, markup]) => {
    const key = /^[a-z]+$/.test(name) ? name : `"${name}"`;
    return `  ${key}:\n    '${markup}',`;
  });
  const prettier = await import("prettier");
  const options = await prettier.resolveConfig(outFile);
  const text = `/**
 * Icon drawings: the inside of each Hugeicons SVG (hugeicons/*.svg, MIT),
 * optimised by svgo. Generated by scripts/icon-drawings.mjs; do not edit,
 * change the SVG file and re-run it. Icon.tsx draws them.
 */
const table = {
${lines.join("\n")}
} as const;

/** Frozen and without a prototype, so a name like "toString" finds nothing */
export const drawings: typeof table = Object.freeze(
  Object.assign(Object.create(null), table),
);
`;
  return prettier.format(text, {
    ...options,
    filepath: outFile,
  });
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const outFile = outFileOf(clientDir());
  const text = await renderDrawings(await buildDrawings());
  if (process.argv.includes("--check")) {
    const current = readFileSync(outFile, "utf8");
    if (current !== text) {
      console.error(
        "drawings.ts is out of date: run node scripts/icon-drawings.mjs",
      );
      process.exit(1);
    }
    console.log("drawings.ts is up to date");
  } else {
    writeFileSync(outFile, text);
    console.log("wrote components/ui/icons/drawings.ts");
  }
}
