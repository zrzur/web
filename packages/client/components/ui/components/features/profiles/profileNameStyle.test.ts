import { afterEach, describe, expect, it } from "vitest";

import { profileNameStyle, readableNameColour } from "./profileNameStyle";
import { readableName, readableTheme } from "./profileTheme";
import { nameColourForLight, setNameView, themeColours } from "./userStyle";

const view = { plain: false, light: false, still: false };

describe("a profile's name", () => {
  afterEach(() => setNameView(view));

  it("on a themed card in a light app is drawn for the card, not the app", () => {
    setNameView({ ...view, light: true });
    const style = { theme: ["#1d2b64"], name_colour: ["#ffd200"] };
    const css = profileNameStyle(style);
    // the card is deep: its bright name stays as chosen
    expect(css.color).toBe("#ffd200");
    expect(css.color).not.toBe(nameColourForLight("#ffd200"));
  });

  it("on a card without a theme follows the app's surface", () => {
    setNameView({ ...view, light: true });
    expect(profileNameStyle({ name_colour: ["#ffd200"] }).color).toBe(
      nameColourForLight("#ffd200"),
    );
  });

  it("keeps a chosen blue on a dark theme, lightened until it reads", () => {
    const theme = { theme: ["#1e3a5f", "#0f2027"] };
    const css = profileNameStyle({ ...theme, name_colour: ["#3B82F6"] });
    const colour = String(css.color);
    // not the card's white ink: the same hue, lighter
    expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(colour).not.toBe("#ffffff");
    const [r, g, b] = [1, 3, 5].map((at) =>
      parseInt(colour.slice(at, at + 2), 16),
    );
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    const surfaces = readableTheme(themeColours(theme)!);
    expect(readableName([colour], surfaces)).toBe(true);
  });

  it("keeps the effect and a readable shade when the colour is too dark", () => {
    setNameView({ ...view, light: true });
    const css = profileNameStyle({
      theme: ["#1d2b64"],
      name_colour: ["#0a0a0a"],
      name_effect: "halo",
    });
    expect(css.color).not.toBe("var(--profile-ink, var(--z-fg-primary))");
    expect(
      readableName(
        [String(css.color)],
        readableTheme(themeColours({ theme: ["#1d2b64"] })!),
      ),
    ).toBe(true);
    expect(css["text-shadow"] ?? css.filter).toBeTruthy();
  });

  it("lightens every colour of a gradient on its own", () => {
    const theme = { theme: ["#1e3a5f", "#0f2027"] };
    const css = profileNameStyle({
      ...theme,
      name_colour: ["#3B82F6", "#7c3aed"],
    });
    const stops = String(css["background-image"]).match(/#[0-9a-f]{6}/g)!;
    expect(stops).toHaveLength(2);
    expect(readableName(stops, readableTheme(themeColours(theme)!))).toBe(true);
  });
});

describe("a readable name colour", () => {
  it("is the colour itself when it already reads", () => {
    expect(readableNameColour("#ffd200", ["#1d2b64"])).toBe("#ffd200");
  });

  it("is undefined only when no shade of it reads", () => {
    // a white surface: lightening can never reach 4.5:1
    expect(readableNameColour("#3b82f6", ["#ffffff"])).toBeUndefined();
  });
});
