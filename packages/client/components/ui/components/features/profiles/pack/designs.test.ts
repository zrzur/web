import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EFFECT_IDS } from "../effects/effectIds";
import { PACK_EFFECT_IDS } from "../effects/packIds.generated";
import { DECORATIONS, NAMEPLATES } from "../userStyle";

import {
  PACK_DECORATIONS,
  PACK_NAMEPLATES,
  PACK_PLATE_DRIFT,
} from "./designs.generated";

const PUBLIC = join(__dirname, "../../../../../../public");
const read = (path: string) => readFileSync(join(PUBLIC, path), "utf8");

describe("design pack", () => {
  it("adds every id once, next to Zrzur's first designs", () => {
    for (const list of [
      DECORATIONS as readonly string[],
      NAMEPLATES.map((plate) => plate.id),
      EFFECT_IDS as readonly string[],
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
    for (const id of PACK_DECORATIONS) expect(DECORATIONS).toContain(id);
    for (const id of PACK_NAMEPLATES) {
      expect(NAMEPLATES.some((plate) => plate.id === id)).toBe(true);
    }
  });

  it.each(PACK_DECORATIONS)("decoration %s is a still 120 unit SVG", (id) => {
    const svg = read(`decorations/${id}.svg`);
    expect(svg).toContain('viewBox="0 0 120 120"');
    expect(svg).toContain('id="play"');
    // motion only when the app asks for it (`file.svg?play#play`)
    for (const rule of svg.split("}")) {
      if (rule.includes("animation:")) expect(rule).toContain("svg:target");
    }
    expect(svg.length).toBeLessThan(36 * 1024);
  });

  it.each(PACK_NAMEPLATES)("nameplate %s is 448 x 84", (id) => {
    const svg = read(`nameplates/${id}.svg`);
    expect(svg).toContain('viewBox="56 2 448 84"');
    expect(svg.length).toBeLessThan(48 * 1024);
  });

  it("has a drift layer for every plate that says so", () => {
    for (const id of PACK_PLATE_DRIFT) {
      expect(existsSync(join(PUBLIC, `nameplates/motion/${id}.svg`))).toBe(
        true,
      );
    }
  });

  it("names every item in Arabic and German", () => {
    const labels = readFileSync(join(__dirname, "labels.generated.ts"), "utf8");
    const english = [...labels.matchAll(/t`((?:[^`\\]|\\.)*)`/g)].map((m) =>
      m[1].replace(/\\(.)/g, "$1"),
    );
    expect(english.length).toBe(
      PACK_DECORATIONS.length + PACK_NAMEPLATES.length + PACK_EFFECT_IDS.length,
    );
    for (const locale of ["ar", "de"]) {
      const po = readFileSync(
        join(__dirname, `../../../../../i18n/catalogs/${locale}/messages.po`),
        "utf8",
      );
      for (const text of english) {
        const at = po.indexOf(`msgid ${JSON.stringify(text)}\n`);
        expect(at, `${locale}: ${text}`).toBeGreaterThan(-1);
        const translated = po.slice(at).split("\n")[1];
        expect(translated, `${locale}: ${text}`).not.toBe('msgstr ""');
      }
    }
  });
});
