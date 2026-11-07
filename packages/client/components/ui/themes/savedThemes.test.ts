import { describe, expect, it } from "vitest";
import { parseThemeImport } from "./savedThemes";

const theme = {
  version: 1,
  name: "My evening theme",
  settings: {
    mode: "dark",
    m3Accent: "#7C8FE8",
    iconAccent: "#B7C0D1",
    iconStyle: "expressive",
    iconSize: 20,
    iconFill: 0.22,
    radius: 10,
    railWidth: 72,
    sidebarWidth: 260,
    density: "comfortable",
    blur: false,
    interfaceFont: "Inter",
    monospaceFont: "Fira Code",
    messageSize: 14,
    messageGroupSpacing: 12,
  },
};
describe("local theme import boundary", () => {
  it("round trips a valid preferences-only theme", () => {
    expect(parseThemeImport(JSON.stringify(theme))).toEqual(theme);
  });
  it.each([
    { ...theme, css: "body { display: none }" },
    {
      ...theme,
      settings: { ...theme.settings, m3Accent: "url(https://example.test)" },
    },
    { ...theme, settings: { ...theme.settings, sidebarWidth: 100000 } },
    { ...theme, settings: { ...theme.settings, script: "alert(1)" } },
    { ...theme, version: 2 },
  ])("rejects untrusted executable or unsupported settings", (input) => {
    expect(() => parseThemeImport(JSON.stringify(input))).toThrow();
  });
  it("keeps surface colours and trims the name", () => {
    const withSurfaces = {
      ...theme,
      name: "  Night  ",
      settings: { ...theme.settings, surfaces: { bgChat: "#1D1F2D" } },
    };
    expect(parseThemeImport(JSON.stringify(withSurfaces))).toEqual({
      ...withSurfaces,
      name: "Night",
    });
  });
  it.each([
    { ...theme, settings: { ...theme.settings, surfaces: { bgChat: "red" } } },
    {
      ...theme,
      settings: { ...theme.settings, surfaces: { other: "#000000" } },
    },
    { ...theme, settings: { ...theme.settings, iconSize: 20.5 } },
    { ...theme, settings: { ...theme.settings, interfaceFont: "Comic" } },
    { ...theme, name: "   " },
  ])("rejects invalid values", (input) => {
    expect(() => parseThemeImport(JSON.stringify(input))).toThrow();
  });
  it("rejects oversized imports before parsing", () => {
    expect(() => parseThemeImport(" ".repeat(65537))).toThrow();
  });
});
