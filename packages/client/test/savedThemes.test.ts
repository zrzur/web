import { describe, expect, it } from "vitest";

import { FONT_KEYS, MONOSPACE_FONT_KEYS } from "../components/ui/themes/fonts";
import {
  parseThemeImport,
  readSavedThemes,
  writeSavedThemes,
} from "../components/ui/themes/savedThemes";

const settings = {
  mode: "dark",
  m3Accent: "#ff2d78",
  iconAccent: "#ff2d78",
  iconStyle: "outline",
  iconSize: 20,
  iconFill: 0,
  radius: 8,
  railWidth: 72,
  sidebarWidth: 240,
  density: "comfortable",
  blur: false,
  interfaceFont: FONT_KEYS[0],
  monospaceFont: MONOSPACE_FONT_KEYS[0],
  messageSize: 16,
  messageGroupSpacing: 16,
};
const theme = { version: 1, name: "Night", settings };

function withStorage<T>(run: (store: Map<string, string>) => T): T {
  const store = new Map<string, string>();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  } as Storage;
  try {
    return run(store);
  } finally {
    globalThis.localStorage = previous;
  }
}

describe("saved theme validation", () => {
  it("accepts a valid theme file", () => {
    expect(parseThemeImport(JSON.stringify(theme))).toEqual(theme);
  });

  it("rejects unknown keys, bad colours and unknown fonts", () => {
    for (const bad of [
      { ...theme, extra: true },
      { ...theme, settings: { ...settings, m3Accent: "red" } },
      { ...theme, settings: { ...settings, interfaceFont: "Comic" } },
      { ...theme, name: "   " },
    ])
      expect(() => parseThemeImport(JSON.stringify(bad))).toThrow();
  });

  it("rejects theme files over 64 KB before parsing", () => {
    expect(() => parseThemeImport(" ".repeat(65537))).toThrow(/64 KB/);
  });

  it("keeps at most 32 saved themes", () => {
    withStorage((store) => {
      writeSavedThemes(Array(32).fill(theme));
      expect(readSavedThemes()).toHaveLength(32);
      expect(() => writeSavedThemes(Array(33).fill(theme))).toThrow();
      store.set(
        "zrzur.saved-themes.v1",
        JSON.stringify(Array(33).fill(theme)),
      );
      expect(() => readSavedThemes()).toThrow();
    });
  });
});
