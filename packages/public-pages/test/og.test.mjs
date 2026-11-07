import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILT_IN } from "../src/catalogue.mjs";
import { renderPng, serverSvg, siteSvg, wrap } from "../src/og.mjs";

test("long descriptions wrap and end with an ellipsis", () => {
  const lines = wrap("one two three four five six seven eight nine ten", 10, 2);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /…$/);
});

test("a server preview renders to a 1200×630 PNG with Arabic text", async () => {
  const png = await renderPng(
    serverSvg(
      {
        _id: "01JC3V9X8Q2W5E7R4T6Y1Z0P9A",
        name: "ربع الحارة",
        description: "سهرات ألعاب كل خميس وجمعة، وقنوات صوتية للعب الجماعي.",
        member_count: 120,
      },
      { counts: "≈ 120 عضو · ≈ 40 متصل", brand: "Zrzur" },
    ),
  );
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  if (process.env.SAVE_PREVIEW) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.SAVE_PREVIEW, png);
    writeFileSync(
      process.env.SAVE_PREVIEW.replace(/\.png$/, "-site.png"),
      await renderPng(
        siteSvg({
          title: "اكتشف زرزور · Zrzur Discover",
          line: "Find your community",
        }),
      ),
    );
  }
});

test("the built-in designs match the app's lists", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const style = read(
    "../../client/components/ui/components/features/profiles/userStyle.ts",
  );
  const looks = read("../../client/src/interface/designs/Looks.tsx");
  const block = (source, name) =>
    source.slice(
      source.indexOf(`export const ${name}`),
      source.indexOf("];", source.indexOf(`export const ${name}`)),
    );
  const ids = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1]);

  assert.deepEqual(
    ids(block(style, "DECORATIONS"), /"([a-z-]+)"/g),
    BUILT_IN.decoration,
  );
  // NAMEPLATES is built from these four lists, in this order
  const list = (name) => {
    const start = style.indexOf(`const ${name} = [`);
    return ids(style.slice(start, style.indexOf("];", start)), /"([^"]+)"/g);
  };
  assert.deepEqual(
    [
      ...list("PLATE_ARAB").map((id) => `flag-${id}`),
      ...list("PLATE_WORLD").map((id) => `flag-${id}`),
      ...list("PLATE_THEMES"),
      ...list("PLATE_SIGNS").map((id) => `zodiac-${id}`),
    ],
    BUILT_IN.nameplate,
  );
  assert.deepEqual(
    ids(block(style, "THEME_PRESETS"), /id: "([^"]+)"/g),
    BUILT_IN.colours,
  );
  assert.deepEqual(
    ids(block(looks, "LOOKS"), /^ {4}id: "([^"]+)"/gm),
    BUILT_IN.look,
  );
});
