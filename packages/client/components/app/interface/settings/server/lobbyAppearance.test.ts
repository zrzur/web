import { describe, expect, it } from "vitest";
import {
  lobbyColour,
  lobbyContrast,
  lobbyInk,
  lobbyStyle,
} from "./lobbyAppearance";

describe("lobby appearance", () => {
  it("accepts only hex colours, blocking CSS values from persisted data", () => {
    expect(lobbyColour("#Ab12F0")).toBe("#Ab12F0");
    for (const value of [
      "red",
      "#fff",
      "url(https://example.com)",
      "#123456;display:none",
    ])
      expect(lobbyColour(value)).toBeUndefined();
  });
  it("keeps foregrounds readable on pale and dark accent buttons", () => {
    for (const colour of [
      "#F3B96B",
      "#55DCC8",
      "#FFFFFF",
      "#000000",
      "#9075FF",
      "#E0195F",
    ]) {
      expect(lobbyContrast(colour, lobbyInk(colour))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(lobbyContrast("#000000", "#FFFFFF")).toBe(21);
  });
  // Module under test: lobbyAppearance.ts lobbyStyle(); this file is the suite.
  it("applies saved colours and layout values to the shared real-page variables", () => {
    const style = lobbyStyle({
      accent: "#55DCC8",
      appearance: {
        background: "#101116",
        secondary: "#64A9FF",
        banner_height: 280,
        radius: 4,
        density: "Compact",
        blend: 35,
        angle: 45,
      },
    });
    expect(style["--z-bg-chat"]).toBe("#101116");
    // raised lifts above the page so cards are not a black pit
    expect(style["--z-bg-raised"]).toBe(
      "color-mix(in srgb, #101116 90%, #FFFFFF 10%)",
    );
    expect(style["--z-card-bg"]).toContain("var(--lobby-surface)");
    expect(style["--lobby-secondary"]).toBe("#64A9FF");
    expect(style["--lobby-banner-height"]).toBe("280px");
    expect(style["--lobby-radius"]).toBe("4px");
    expect(style["--lobby-card-pad"]).toBe("14px");
    expect(style["--lobby-blend"]).toBe("35%");
    expect(style["--lobby-angle"]).toBe("45deg");
  });
  it("inherits the member's app colours when no overrides are configured", () => {
    const style = lobbyStyle({});
    expect(style["--z-bg-chat"]).toBeUndefined();
    expect(style["--z-fg-primary"]).toBeUndefined();
    expect(style["--lobby-accent"]).toBeUndefined();
  });
  it("keeps the original banner when the API returns null optional settings", () => {
    const style = lobbyStyle(
      JSON.parse('{"appearance":{"angle":null,"blend":null,"secondary":null}}'),
    );
    expect(style["--lobby-banner-paint"]).toBeUndefined();
  });
  it("uses a readable card foreground without changing the rest of the page", () => {
    const style = lobbyStyle({ appearance: { surface: "#FFFFFF" } });
    expect(style["--lobby-card-ink"]).toBe("#101116");
    expect(style["--z-bg-raised"]).toBeUndefined();
    expect(style["--z-fg-primary"]).toBeUndefined();
    expect(style["--z-bg-chat"]).toBeUndefined();
  });
});
