import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAME_GRADIENTS, NAME_SOLIDS } from "./nameStyles";
import {
  DECORATIONS,
  NAMEPLATES,
  NAME_FONTS,
  effectFileUrl,
  effectStillUrl,
  nameStyle,
  nameplateBackground,
  themeColours,
  userStyleOf,
} from "./userStyle";

const PUBLIC = join(__dirname, "../../../../../public");

/** WCAG contrast of two `#rrggbb` colours */
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("community images", () => {
  const style = { nameplate: "c:1", nameplate_file: "abc" };

  it("stays still unless the caller says it may move", () => {
    expect(nameplateBackground(style, "https://cdn")).toContain(
      'url("https://cdn/decorations/abc")',
    );
    expect(nameplateBackground(style, "https://cdn")).not.toContain("original");
    expect(
      nameplateBackground(style, "https://cdn", { moving: true }),
    ).toContain("/decorations/abc/original");
  });
});

describe("user style", () => {
  it("draws a solid or gradient name and keeps the font without colour", () => {
    expect(nameStyle({ name_colour: ["#ff0000"] }).color).toBe("#ff0000");
    const gradient = nameStyle({ name_colour: ["#ff0000", "#0000ff"] });
    expect(gradient["background-image"]).toContain("#ff0000");
    expect(gradient.color).toBe("transparent");
    const fontOnly = nameStyle(
      { name_font: "serif", name_colour: ["#ff0000"] },
      { colour: false },
    );
    expect(fontOnly["font-family"]).toContain("Georgia");
    expect(fontOnly.color).toBeUndefined();
  });

  it("never passes anything but #rrggbb colours into styles", () => {
    expect(nameStyle({ name_colour: ["red;background:url(x)"] })).toEqual({});
    expect(themeColours({ theme: ["url(javascript:x)"] })).toBeUndefined();
    expect(themeColours({ theme: ["#112233"] })).toEqual({
      top: "#112233",
      bottom: "#112233",
    });
  });

  it("ignores unknown fonts and missing styles", () => {
    expect(nameStyle({ name_font: "comic-sans" })).toEqual({});
    expect(nameStyle(undefined)).toEqual({});
    expect(userStyleOf({})).toBeUndefined();
    expect(
      userStyleOf({ style: { decoration: "lightning" } })?.decoration,
    ).toBe("lightning");
    expect(userStyleOf({ style: { decoration: "c:01ABC" } })?.decoration).toBe(
      "c:01ABC",
    );
  });

  it("treats removed designs as none", () => {
    const style = userStyleOf({
      style: {
        decoration: "headphones",
        decoration_file: "x",
        nameplate: "galaxy",
        nameplate_file: "y",
        name_font: "serif",
      },
    });
    expect(style?.decoration).toBeUndefined();
    expect(style?.decoration_file).toBeUndefined();
    expect(style?.nameplate).toBeUndefined();
    expect(style?.nameplate_file).toBeUndefined();
    expect(style?.name_font).toBe("serif");
    expect(userStyleOf({ style: { nameplate: "aurora" } })?.nameplate).toBe(
      "aurora",
    );
    expect(userStyleOf({ style: { nameplate: "flag-sy" } })?.nameplate).toBe(
      "flag-sy",
    );
    expect(userStyleOf({ style: { nameplate: "c:01ABC" } })?.nameplate).toBe(
      "c:01ABC",
    );
  });

  it("matches the server's allow-lists", () => {
    // keep in sync with USER_STYLE_FONTS / USER_STYLE_DECORATIONS (Rust)
    expect(NAME_FONTS).toHaveLength(20);
    expect(new Set(NAME_FONTS.map((f) => f.id)).size).toBe(20);
    expect(DECORATIONS).toHaveLength(24);
    expect(NAMEPLATES).toHaveLength(217);
    expect(new Set(NAMEPLATES.map((p) => p.id)).size).toBe(217);
    for (const removed of ["crown", "halo", "horns", "cat-ears", "rainbow"])
      expect(DECORATIONS).not.toContain(removed);
  });

  it("ships a file for every design", () => {
    for (const id of DECORATIONS) {
      expect(existsSync(join(PUBLIC, `decorations/${id}.svg`))).toBe(true);
    }
    for (const plate of NAMEPLATES) {
      expect(existsSync(join(PUBLIC, `nameplates/${plate.id}.svg`))).toBe(true);
    }
  });

  it("moves only when a frame is asked to", () => {
    for (const id of DECORATIONS) {
      const art = readFileSync(join(PUBLIC, `decorations/${id}.svg`), "utf8");
      for (const rule of art.matchAll(/([^{}]*)\{animation:/g)) {
        expect(rule[1]).toContain(":target");
      }
    }
  });

  it("puts the Arab countries first, with Syria's current flag", () => {
    expect(NAMEPLATES.slice(0, 22).every((p) => p.group === "arab")).toBe(true);
    expect(NAMEPLATES[22].group).toBe("flag");
    const syria = readFileSync(join(PUBLIC, "nameplates/flag-sy.svg"), "utf8");
    expect(syria).toMatch(/#007a3d/i);
    expect(syria).toMatch(/#ce1126/i);
  });

  it("makes every flag exactly 448 x 84, with no fade of its own", () => {
    for (const plate of NAMEPLATES) {
      const art = readFileSync(
        join(PUBLIC, `nameplates/${plate.id}.svg`),
        "utf8",
      );
      expect(art).toMatch(/^<svg[^>]* width="448" height="84"/);
      expect(art).not.toContain('id="zv"');
    }
    const plain = nameplateBackground({ nameplate: "flag-sy" }, "https://cdn");
    expect(plain).toContain("flag-sy.svg");
    // no wash in the art or over it: the mask in decorations.css does the fade
    expect(plain).not.toContain("linear-gradient");
    expect(plain).toContain("flag-sy.svg#rtl");
    expect(plain).not.toContain("cover");
  });

  it("stands the true flag at the end, at full height, never stretched", () => {
    for (const plate of NAMEPLATES.filter((p) => p.id.startsWith("flag-"))) {
      const art = readFileSync(
        join(PUBLIC, `nameplates/${plate.id}.svg`),
        "utf8",
      );
      expect(art).toContain('<use href="#zf" width="112" height="84"/>');
      expect(art).toContain("translate(336)");
    }
  });

  it("keeps every name colour readable on dark surfaces", () => {
    expect(NAME_GRADIENTS.length).toBeGreaterThanOrEqual(60);
    for (const surface of ["#171925", "#1D1F2D", "#242638"]) {
      for (const colour of [...NAME_SOLIDS, ...NAME_GRADIENTS.flat()]) {
        expect(contrast(colour, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("a creator's effect", () => {
  it("has a file address for playing and one for its still", () => {
    expect(effectFileUrl("https://cdn", "abc")).toBe(
      "https://cdn/effects/abc/original",
    );
    expect(effectStillUrl("https://cdn", "abc")).toBe(
      "https://cdn/effects/abc",
    );
    expect(effectFileUrl("https://cdn", "../x")).toBeUndefined();
    expect(effectStillUrl("https://cdn", undefined)).toBeUndefined();
  });
});
