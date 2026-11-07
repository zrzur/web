import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isEmojiPackAvailable,
  UnicodeEmoji,
  unicodeEmojiUrl,
} from "../components/markdown/emoji/UnicodeEmoji";
vi.mock("@revolt/state", () => ({
  useState: () => ({ settings: { getValue: () => "fluent-flat" } }),
}));
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.stubEnv("VITE_EMOJI_CDN", "");
  vi.stubEnv("BASE_URL", "/");
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
});
describe("emoji artwork and native fallback", () => {
  it("uses verified same-origin bundled art", () => {
    const url = unicodeEmojiUrl("fluent-flat", "😂");
    expect(url).toBe("/emoji/2.2.0/fluent-flat/1f602.svg");
    expect(existsSync(resolve("public" + url))).toBe(true);
  });
  it("preserves skin modifiers and canonical variation sequences", () => {
    for (const emoji of ["❤️", "👋🏽"]) {
      const url = unicodeEmojiUrl("fluent-flat", emoji);
      expect(url).toContain("/emoji/2.2.0/");
      expect(existsSync(resolve("public" + url))).toBe(true);
    }
  });
  it("never creates an empty-source image for system or missing artwork", () => {
    expect(unicodeEmojiUrl("system", "👨‍👩‍👧‍👦")).toBe("");
    expect(isEmojiPackAvailable("system")).toBe(true);
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => createComponent(UnicodeEmoji, { emoji: "👨‍👩‍👧‍👦", pack: "system" }),
      host,
    );
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("👨‍👩‍👧‍👦");
  });
  it("falls back after a real image load error", () => {
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => createComponent(UnicodeEmoji, { emoji: "😂", pack: "fluent-flat" }),
      host,
    );
    expect(host.querySelector("img")).not.toBeNull();
    host.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("😂");
  });
});
