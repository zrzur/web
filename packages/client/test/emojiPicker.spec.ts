import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompositionMediaPickerContext } from "../components/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { EmojiPicker } from "../components/ui/components/features/messaging/composition/picker/EmojiPicker";

const fixture = vi.hoisted(() => {
  const emojis = [
    { shorthands: ["smile"], emoji: "😄" },
    { shorthands: ["wave"], emoji: "👋" },
    { shorthands: ["family"], emoji: "👨‍👩‍👧‍👦" },
    { shorthands: ["skin-tone"], emoji: "👍🏽" },
    { shorthands: ["flag"], emoji: "🇦🇹" },
    { shorthands: ["heart"], emoji: "❤️" },
  ];
  return {
    insert: vi.fn(),
    emojis,
    server: {
      id: "server",
      name: "Test server",
      emojis: [{ id: "custom", name: "party" }],
    },
  };
});
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ servers: new Map([["server", fixture.server]]) }),
}));
vi.mock("@revolt/common", () => ({
  useDevice: () => ({ isMobile: false, layout: () => "desktop" }),
}));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
vi.mock("@revolt/routing", () => ({ useSmartParams: () => () => ({}) }));
vi.mock("@revolt/state", () => ({
  useState: () => ({
    ordering: { orderedServers: () => [fixture.server] },
    settings: { getValue: () => "default" },
  }),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: () => document.createElement("span"),
}));
vi.mock(
  "../components/ui/components/features/messaging/composition/picker/GifPicker",
  () => ({ GifPicker: () => null }),
);
vi.mock("@revolt/ui/components/design", () => ({
  Avatar: () => document.createElement("span"),
}));
vi.mock("@revolt/markdown/emoji", () => ({
  UnicodeEmoji: (props: { emoji: string }) => props.emoji,
  CustomEmoji: () => document.createElement("span"),
}));
vi.mock("@revolt/markdown/emoji/UnicodeEmoji", () => ({
  UNICODE_EMOJI_PACK_PUA: {},
  UNICODE_ZWNJ: "",
  isRegionalIndicator: () => false,
  isEmojiPackAvailable: () => true,
  unicodeEmojiUrl: () => "emoji.svg",
}));
vi.mock("@revolt/ui/emojis", () => ({
  searchEmoji: (query: string) =>
    fixture.emojis.filter((e) => e.shorthands[0].includes(query)),
}));
vi.mock(
  "../components/ui/components/features/messaging/composition/picker/emojiSections",
  () => ({
    EMOJI_CATEGORIES: [{ id: "people", emoji: fixture.emojis.slice(0, 2) }],
  }),
);

let dispose: (() => void) | undefined;
beforeEach(() => {
  // jsdom has no layout: no ResizeObserver, and every element measures 0, which
  // would leave the windowed list with only its overscan rows
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(320);
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(336);
  localStorage.clear();
  fixture.insert.mockReset();
  const host = document.createElement("div");
  document.body.append(host);
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  dispose = render(
    () =>
      createComponent(I18nProvider, {
        i18n,
        get children() {
          return createComponent(CompositionMediaPickerContext.Provider, {
            value: { onMessage: vi.fn(), onTextReplacement: fixture.insert },
            get children() {
              return createComponent(EmojiPicker, {});
            },
          });
        },
      }),
    host,
  );
});
afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
function search(value: string) {
  const input = document.querySelector<HTMLInputElement>("input")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function option(label: string) {
  return document.querySelector<HTMLButtonElement>(
    `button.z-emoji-cell[aria-label="${label}"]`,
  )!;
}
const headings = () =>
  [...document.querySelectorAll(".z-emoji-heading")].map((h) => h.textContent);

describe("emoji picker", () => {
  it("shows the tip, server sections and the emoji categories", () => {
    expect(document.body.textContent).toContain("right-click (or hold)");
    expect(headings()).toEqual(["Test server", "Smileys & people"]);
    expect(option("smile")).not.toBeNull();
    expect(option("flag")).toBeNull();
  });
  it("inserts a Unicode emoji", () => {
    option("smile").click();
    expect(fixture.insert).toHaveBeenCalledExactlyOnceWith("😄");
  });
  it("inserts a custom server emoji", () => {
    option("party").click();
    expect(fixture.insert).toHaveBeenCalledExactlyOnceWith(":custom:");
  });
  it("search covers every emoji, case-insensitively and trimmed", () => {
    search(" WAVE ");
    expect(option("wave")).not.toBeNull();
    expect(option("smile")).toBeNull();
    search("flag");
    expect(option("flag")).not.toBeNull();
  });
  it("shows an empty state and clears search", () => {
    search("no-match-anywhere");
    expect(document.body.textContent).toContain("No emoji found");
    document
      .querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!
      .click();
    expect(option("smile")).not.toBeNull();
  });
  it("right-click adds and removes a favourite, kept across opens", () => {
    option("wave").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(headings()[0]).toBe("Favorites");
    expect(localStorage.getItem("zrzur:emoji-favourites")).toContain("👋");
    // favourites come first, so this is the copy in that section
    option("wave").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(headings()).not.toContain("Favorites");
    expect(localStorage.getItem("zrzur:emoji-favourites")).not.toContain("👋");
  });
});

it.each([
  ["family", "👨‍👩‍👧‍👦"],
  ["skin-tone", "👍🏽"],
  ["flag", "🇦🇹"],
  ["heart", "❤️"],
])("preserves complex sequence %s during insertion", (label, emoji) => {
  search(label);
  option(label).click();
  expect(fixture.insert).toHaveBeenCalledExactlyOnceWith(emoji);
});
