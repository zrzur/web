import { describe, expect, it } from "vitest";

import { pwaThemeColour } from "./pwaThemeColour";

describe("pwaThemeColour", () => {
  const props = {
    "--z-bg-frame": "#0D0E16",
    "--md-sys-color-primary-container": "#5A1030",
    "--md-sys-color-surface-container-high": "#2A2B33",
  };

  it("is the frame colour, the one under the status bar", () => {
    expect(pwaThemeColour(props, false)).toBe("#0D0E16");
  });

  it("follows the theme's frame colour", () => {
    expect(pwaThemeColour({ ...props, "--z-bg-frame": "#F4F5FA" }, false)).toBe(
      "#F4F5FA",
    );
  });

  it("uses the connection banner's colour while it shows", () => {
    expect(pwaThemeColour(props, true)).toBe("#5A1030");
  });

  it("falls back to the default dark frame", () => {
    expect(pwaThemeColour({}, false)).toBe("#0D0E16");
    expect(pwaThemeColour({}, true)).toBe("#0D0E16");
  });
});
