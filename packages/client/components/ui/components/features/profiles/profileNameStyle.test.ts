import { afterEach, describe, expect, it } from "vitest";

import { profileNameStyle } from "./profileNameStyle";
import { nameColourForLight, setNameView } from "./userStyle";

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

  it("keeps the effect but takes the card's ink when the colour can't read", () => {
    setNameView({ ...view, light: true });
    const css = profileNameStyle({
      theme: ["#1d2b64"],
      name_colour: ["#0a0a0a"],
      name_effect: "halo",
    });
    expect(css.color).toBe("var(--profile-ink, var(--z-fg-primary))");
    expect(css["text-shadow"] ?? css.filter).toBeTruthy();
  });
});
