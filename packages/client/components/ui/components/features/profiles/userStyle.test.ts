import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAME_GRADIENTS, NAME_SOLIDS, NAME_SPECTRA } from "./nameStyles";
import { PACK_DECORATIONS, PACK_NAMEPLATES } from "./pack/designs.generated";
import {
  type UserStyle,
  DECORATIONS,
  NAMEPLATES,
  NAME_EFFECTS,
  NAME_FONTS,
  nameColourForLight,
  nameStyle,
  nameplateBackground,
  setNameView,
  themeColours,
  userStyleOf,
} from "./userStyle";
import {
  STYLE_FIELDS,
  communityShownUrl,
  effectFileUrl,
  effectStillUrl,
  sendableStyle,
} from "./userStyleExtras";

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
    // an effect that was cut from the pack: saving must not send it back
    const cut = userStyleOf({
      style: { effect: "no-such-effect", effect_file: "z", name_font: "serif" },
    });
    expect(cut?.effect).toBeUndefined();
    expect(cut?.effect_file).toBeUndefined();
    expect(cut?.name_font).toBe("serif");
    expect(userStyleOf({ style: { effect: "snow" } })?.effect).toBe("snow");
    expect(userStyleOf({ style: { effect: "c:01ABC" } })?.effect).toBe(
      "c:01ABC",
    );
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
    // Zrzur's first designs, then the design pack's
    expect(DECORATIONS).toHaveLength(24 + PACK_DECORATIONS.length);
    expect(NAMEPLATES).toHaveLength(217 + PACK_NAMEPLATES.length);
    expect(new Set(NAMEPLATES.map((p) => p.id)).size).toBe(
      217 + PACK_NAMEPLATES.length,
    );
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
      // a plain scan: a pattern here backtracked for seconds on long paths
      for (const rule of art.split("}")) {
        const at = rule.indexOf("{animation:");
        if (at < 0) continue;
        const selector = rule.slice(rule.lastIndexOf("{", at - 1) + 1, at);
        expect(selector).toContain(":target");
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
    // its own address, so the left-to-right copy is never reused for it
    expect(plain).toContain("flag-sy.svg?rtl#rtl");
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
      for (const colour of [
        ...NAME_SOLIDS,
        ...NAME_GRADIENTS.flat(),
        ...NAME_SPECTRA.flat(),
      ]) {
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

describe("a community design shown to someone saving data", () => {
  it("comes as its still frame, for decorations, nameplates and effects", () => {
    expect(communityShownUrl("https://cdn", "Decoration", "abc", true)).toBe(
      "https://cdn/decorations/abc",
    );
    expect(communityShownUrl("https://cdn", "Nameplate", "abc", true)).toBe(
      "https://cdn/decorations/abc",
    );
    expect(communityShownUrl("https://cdn", "Effect", "abc", true)).toBe(
      "https://cdn/effects/abc",
    );
  });

  it("comes as uploaded for everyone else", () => {
    expect(communityShownUrl("https://cdn", "Decoration", "abc", false)).toBe(
      "https://cdn/decorations/abc/original",
    );
    expect(communityShownUrl("https://cdn", "Effect", "abc", false)).toBe(
      "https://cdn/effects/abc/original",
    );
  });

  it("is nothing without a file", () => {
    expect(
      communityShownUrl("https://cdn", "Decoration", undefined, true),
    ).toBeUndefined();
  });
});

describe("name effects", () => {
  const still = { plain: false, light: false, still: false };

  it("draws a spectrum of three to five colours, still unless asked", () => {
    setNameView(still);
    const five = ["#ff5c8a", "#ffb347", "#7ee081", "#6dd5ed", "#b794ff"];
    const css = nameStyle({ name_colour: five });
    expect(css["background-image"]).toContain("#b794ff");
    expect(css.animation).toBeUndefined();
    expect(
      nameStyle({ name_colour: five }, { moving: true }).animation,
    ).toContain("z-name-flow");
    // a sixth colour is never drawn
    const six = nameStyle({ name_colour: [...five, "#000000"] });
    expect(six["background-image"]).not.toContain("#000000");
  });

  it("draws each effect and ignores unknown ones", () => {
    setNameView(still);
    for (const effect of NAME_EFFECTS) {
      const css = nameStyle({ name_colour: ["#6dd5ed"], name_effect: effect });
      expect(
        css["text-shadow"] ?? css.filter ?? css["background-image"],
      ).toBeTruthy();
    }
    const unknown = nameStyle({
      name_colour: ["#6dd5ed"],
      name_effect: "x;background:url(y)",
    });
    expect(unknown).toEqual({ color: "#6dd5ed" });
  });

  it("keeps an effect with a role colour, as a filter", () => {
    setNameView(still);
    const css = nameStyle(
      { name_colour: ["#6dd5ed"], name_effect: "halo" },
      { colour: false },
    );
    expect(css.color).toBeUndefined();
    expect(css.filter).toContain("drop-shadow");
  });

  it("stops moving under reduced motion", () => {
    setNameView({ ...still, still: true });
    const css = nameStyle(
      { name_colour: ["#b794ff", "#ff8ac4"], name_effect: "sheen" },
      { moving: true },
    );
    expect(css.animation).toBeUndefined();
    setNameView(still);
  });

  it("darkens colours on light surfaces until they read", () => {
    for (const colour of [
      ...NAME_SOLIDS,
      ...NAME_GRADIENTS.flat(),
      ...NAME_SPECTRA.flat(),
    ]) {
      const shade = nameColourForLight(colour);
      for (const surface of ["#FFFFFF", "#F3F4FA", "#EEF0F7", "#E4E6F0"]) {
        expect(contrast(shade, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    // a colour that already reads stays as it is
    expect(nameColourForLight("#171925")).toBe("#171925");
    setNameView({ ...still, light: true });
    expect(nameStyle({ name_colour: ["#ffffff"] }).color).not.toBe("#ffffff");
    expect(
      nameStyle({ name_colour: ["#ffffff"] }, { surface: "dark" }).color,
    ).toBe("#ffffff");
    setNameView(still);
  });

  it("keeps every sheen stop readable on light surfaces", () => {
    setNameView({ ...still, light: true });
    const pairs = [
      ...NAME_SOLIDS.map((c) => [c]),
      ...NAME_GRADIENTS,
      ...NAME_SPECTRA,
    ];
    for (const colours of pairs) {
      const image = nameStyle({
        name_colour: colours,
        name_effect: "sheen",
      })["background-image"] as string;
      const stops = image.match(/#[0-9a-fA-F]{6}/g) ?? [];
      // two colours and the band: nothing left as a colour-mix or white
      expect(stops.length, image).toBe(3);
      expect(image).not.toContain("color-mix");
      for (const stop of stops) {
        for (const surface of ["#FFFFFF", "#F3F4FA", "#EEF0F7", "#E4E6F0"]) {
          expect(
            contrast(stop, surface),
            `${stop} in ${image}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    setNameView(still);
  });

  it("shows every name plain when the viewer turns name styles off", () => {
    setNameView({ ...still, plain: true });
    const style = { name_font: "serif", name_colour: ["#ff0000"] };
    expect(nameStyle(style)).toEqual({});
    // the editor's own preview still draws
    expect(nameStyle(style, { always: true }).color).toBe("#ff0000");
    setNameView(still);
  });
});

describe("a style sent to be saved", () => {
  it("keeps every choice the server stores, and no file but an effect's", () => {
    const full: Required<UserStyle> = {
      theme: ["#112233", "#445566"],
      name_font: "serif",
      name_colour: ["#ff5c8a", "#ffb347", "#7ee081"],
      name_effect: "sheen",
      decoration: "c:01M5TGZFE80SKMC8JVGJKBHS2A",
      decoration_file: "dfile",
      nameplate: "aurora",
      nameplate_file: "pfile",
      effect: "c:01M5TGZFE80SKMC8JVGJKBHS2B",
      effect_file: "efile",
      profile_frame: "crystal",
      profile_frame_file: "ffile",
    };
    // the test's style names every field the type has
    expect(Object.keys(full).sort()).toEqual(Object.keys(STYLE_FIELDS).sort());
    const sent = sendableStyle(full);
    for (const [key, kind] of Object.entries(STYLE_FIELDS)) {
      const field = key as keyof UserStyle;
      if (kind === "choice") expect(sent[field], key).toEqual(full[field]);
    }
    expect(sent.name_effect).toBe("sheen");
    expect(sent.effect_file).toBe("efile");
    expect(sent.decoration_file).toBeUndefined();
    expect(sent.nameplate_file).toBeUndefined();
    expect(sent.profile_frame_file).toBeUndefined();
  });

  it("leaves out empty parts", () => {
    expect(
      sendableStyle({ theme: [], name_colour: [], name_effect: "" }),
    ).toEqual({});
  });
});
