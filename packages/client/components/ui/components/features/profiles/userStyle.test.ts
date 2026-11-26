import { describe, expect, it } from "vitest";

import { NAME_GRADIENTS, NAME_SOLIDS, NAME_SPECTRA } from "./nameStyles";
import {
  type UserStyle,
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
    expect(userStyleOf({ style: { decoration: "c:01ABC" } })?.decoration).toBe(
      "c:01ABC",
    );
  });

  it("treats a built-in design still stored on a user as none", () => {
    // the built-in designs became creators' designs on 2026-11-26; a value
    // saved before then draws nothing, and saving must not send it back
    const style = userStyleOf({
      style: {
        decoration: "lightning",
        decoration_file: "x",
        nameplate: "flag-sy",
        nameplate_file: "y",
        effect: "snow",
        effect_file: "z",
        profile_frame: "crystal",
        profile_frame_file: "w",
        name_font: "serif",
        name_colour: ["#ff0000"],
        theme: ["#112233"],
      },
    });
    expect(style).toEqual({
      name_font: "serif",
      name_colour: ["#ff0000"],
      theme: ["#112233"],
    });
    for (const old of ["headphones", "galaxy", "aurora", "rank-gold", "khatam"])
      expect(userStyleOf({ style: { decoration: old } })?.decoration).toBe(
        undefined,
      );
  });

  it("keeps every creator's design", () => {
    const worn = {
      decoration: "c:01ABC",
      decoration_file: "a",
      nameplate: "c:01ABD",
      nameplate_file: "b",
      effect: "c:01ABE",
      effect_file: "c",
      profile_frame: "c:01ABF",
      profile_frame_file: "d",
    };
    expect(userStyleOf({ style: worn })).toEqual(worn);
  });

  it("has no art for a built-in nameplate", () => {
    for (const nameplate of ["flag-sy", "aurora", "zodiac-leo", "arcade-night"])
      expect(nameplateBackground({ nameplate }, "https://cdn")).toBeUndefined();
  });

  it("matches the server's allow-lists", () => {
    // keep in sync with USER_STYLE_FONTS (Rust)
    expect(NAME_FONTS).toHaveLength(20);
    expect(new Set(NAME_FONTS.map((f) => f.id)).size).toBe(20);
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
      nameplate: "c:01M5TGZFE80SKMC8JVGJKBHS2C",
      nameplate_file: "pfile",
      effect: "c:01M5TGZFE80SKMC8JVGJKBHS2B",
      effect_file: "efile",
      profile_frame: "c:01M5TGZFE80SKMC8JVGJKBHS2D",
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

  it("never sends a built-in design", () => {
    expect(
      sendableStyle({
        decoration: "laurel",
        nameplate: "flag-sy",
        effect: "snow",
        effect_file: "z",
        profile_frame: "crystal",
        name_font: "serif",
      }),
    ).toEqual({ name_font: "serif" });
    expect(
      sendableStyle({ decoration: "c:01ABC", profile_frame: "c:01ABD" }),
    ).toEqual({ decoration: "c:01ABC", profile_frame: "c:01ABD" });
  });

  it("leaves out empty parts", () => {
    expect(
      sendableStyle({ theme: [], name_colour: [], name_effect: "" }),
    ).toEqual({});
  });
});
