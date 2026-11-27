import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * On phones, styles.css gives buttons an unseen `::after` tap area that is
 * positioned absolute; the button's `position: relative` comes from
 * `@layer base`. A button styled with `all: "unset"` loses that, and the tap
 * area then covers its nearest positioned ancestor, often the whole page.
 * Every `all: "unset"` on a button must set a `position` in the same block.
 */

const ROOT = join(__dirname, "..", "..");
const DIRS = ["src", "components"];

const UNSET = /\ball:\s*["']unset["']/g;

export type Finding = { line: number; element: string; hasPosition: boolean };

/** index of the `{` that opens the object literal around `at` */
function openingBrace(text: string, at: number): number {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    const c = text[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** the object literal's own keys (depth 1 only) */
function topLevelText(text: string, open: number): string {
  let depth = 0;
  let out = "";
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1) out += c;
  }
  return out;
}

/** the element a style block belongs to: styled("x") or the JSX <x */
function elementOf(text: string, open: number): string {
  const before = text.slice(0, open);
  const styled = [...before.matchAll(/styled\(\s*["'](\w+)["']/g)].pop();
  const tag = [...before.matchAll(/<([a-zA-Z][\w.]*)[\s>]/g)].pop();
  const styledAt = styled?.index ?? -1;
  const tagAt = tag?.index ?? -1;
  if (styledAt < 0 && tagAt < 0) return "";
  return styledAt > tagAt ? styled![1] : tag![1];
}

export function scan(text: string): Finding[] {
  const found: Finding[] = [];
  for (const m of text.matchAll(UNSET)) {
    const open = openingBrace(text, m.index!);
    if (open < 0) continue;
    // a styled() call nests the block in `base: { ... }`; the inline style
    // is `style={{ ... }}`: either way the keys sit in this one object
    const own = topLevelText(text, open).replace(/\/\/[^\n]*/g, "");
    found.push({
      line: text.slice(0, m.index).split("\n").length,
      element: elementOf(text, open),
      hasPosition: /(^|[\s,{])position\s*:/.test(own),
    });
  }
  return found;
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(path);
  }
  return out;
}

describe("unset tap area checker", () => {
  it("flags a styled button without position", () => {
    const bad = `const B = styled("button", {\n  base: {\n    all: "unset",\n    cursor: "pointer",\n  },\n});`;
    expect(scan(bad)).toEqual([
      { line: 3, element: "button", hasPosition: false },
    ]);
  });

  it("flags an inline style on a button without position", () => {
    const bad = `<button type="button" style={{ all: "unset", display: "grid" }}>x</button>`;
    expect(scan(bad)).toEqual([
      { line: 1, element: "button", hasPosition: false },
    ]);
  });

  it("does not count a position in a comment or a nested block", () => {
    const bad = `const B = styled("button", {\n  base: {\n    all: "unset",\n    // position: relative\n    "&:hover": { position: "absolute" },\n  },\n});`;
    expect(scan(bad)[0].hasPosition).toBe(false);
  });

  it("passes a button that sets its position", () => {
    const good = `const B = styled("button", {\n  base: {\n    all: "unset",\n    position: "relative",\n  },\n});\n<button style={{ all: "unset", position: "relative" }} />`;
    expect(scan(good).map((f) => f.hasPosition)).toEqual([true, true]);
  });

  it("ignores elements that are not buttons", () => {
    const other = `const D = styled("div", { base: { all: "unset" } });`;
    expect(scan(other)[0].element).toBe("div");
  });
});

describe("every all: unset button keeps a position", () => {
  const all = DIRS.flatMap((d) => files(join(ROOT, d))).flatMap((path) => {
    const text = readFileSync(path, "utf-8");
    if (!UNSET.test(text)) return [];
    UNSET.lastIndex = 0;
    const file = relative(ROOT, path).replace(/\\/g, "/");
    return scan(text)
      .filter((f) => f.element === "button")
      .map((f) => ({ file, ...f }));
  });

  it("finds the known buttons (the scan is not empty)", () => {
    expect(all.some((f) => f.file.endsWith("VoiceCallCardPiP.tsx"))).toBe(true);
    // the support tickets list became settings rows (2026-11-27)
    expect(all.length).toBeGreaterThanOrEqual(7);
  });

  it("has no button without a position", () => {
    const missing = all.filter((f) => !f.hasPosition);
    expect(missing.map((f) => `${f.file}:${f.line}`)).toEqual([]);
  });
});
