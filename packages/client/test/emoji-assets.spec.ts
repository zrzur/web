import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnicodeEmoji,
  twemojiKey,
  unicodeEmojiUrl,
} from "../components/markdown/emoji/UnicodeEmoji";

// the reader's style when no pack is passed
let style = "system";
vi.mock("@revolt/state", () => ({
  useState: () => ({ settings: { getValue: () => style } }),
}));
let dispose: (() => void) | undefined;
beforeEach(() => {
  vi.stubEnv("BASE_URL", "/");
  style = "system";
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
});

const mount = (props: { emoji: string; pack?: "system" | "twemoji" }) => {
  const host = document.createElement("div");
  document.body.append(host);
  dispose = render(() => createComponent(UnicodeEmoji, props), host);
  return host;
};

describe("emoji styles", () => {
  it("draws the device's own emoji by default, with no image to load", () => {
    expect(unicodeEmojiUrl(undefined, "😂")).toBe("");
    const host = mount({ emoji: "👨‍👩‍👧‍👦" });
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("👨‍👩‍👧‍👦");
  });

  it("uses bundled Twemoji images, same origin, for the Twitter style", () => {
    for (const emoji of ["😂", "❤️", "👋🏽", "👨‍👩‍👧‍👦", "🏳️‍🌈", "#️⃣"]) {
      const url = unicodeEmojiUrl("twemoji", emoji);
      expect(url, emoji).toMatch(
        /^\/emoji\/twemoji-14\.0\.2\/[0-9a-f-]+\.svg$/,
      );
      expect(existsSync(resolve("public" + url)), emoji).toBe(true);
    }
  });

  it("names files as Twemoji does: fe0f kept only where its file has it", () => {
    expect(twemojiKey("❤️")).toBe("2764");
    expect(twemojiKey("🏳️‍🌈")).toBe("1f3f3-fe0f-200d-1f308");
  });

  it("follows the reader's choice when no style is passed", () => {
    style = "twemoji";
    expect(mount({ emoji: "😂" }).querySelector("img")).not.toBeNull();
  });

  it("falls back to the device's emoji after an image fails", () => {
    const host = mount({ emoji: "😂", pack: "twemoji" });
    host.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("😂");
  });

  it("keeps flags as images in every style (Windows has no flag emoji)", () => {
    expect(unicodeEmojiUrl("system", "🇸🇾")).toContain(
      "/emoji/flags-twemoji-14.0.2/",
    );
  });
});
