import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpecialEmbed } from "../components/ui/components/features/messaging/elements/SpecialEmbed";
import {
  FALLBACK_POLICY,
  isPlayerEmbed,
  playersPolicyUrl,
  setAlwaysLoadMediaPlayers,
} from "../components/ui/components/features/messaging/elements/embedSettings";

vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    configuration: {
      features: {
        legal_links: { privacy_policy: "https://zrzur.test/privacy" },
      },
    },
  }),
}));
vi.mock("@revolt/ui/components/utils", () => ({
  SizedContent: (props: { children: unknown }) => props.children,
}));
vi.mock("@revolt/ui/components/design", () => ({
  Button: (props: {
    onPress: () => void;
    children: unknown;
    "aria-label"?: string;
  }) => {
    const button = document.createElement("button");
    if (props["aria-label"])
      button.setAttribute("aria-label", props["aria-label"]);
    button.onclick = () => props.onPress();
    button.append(props.children as Node);
    return button;
  },
}));

const embed = (type: string, embedURL: string) =>
  ({
    specialContent: { type },
    embedURL,
    title: "A video",
    siteName: type,
    image: { proxiedURL: "https://proxy.test/proxy?url=thumb" },
  }) as never;

let dispose: (() => void) | undefined;
function mount(value: never) {
  const host = document.createElement("div");
  document.body.append(host);
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  dispose = render(
    () =>
      createComponent(I18nProvider, {
        i18n,
        get children() {
          return createComponent(SpecialEmbed, { embed: value });
        },
      }),
    host,
  );
}
const providers: [string, string, string][] = [
  ["YouTube", "https://www.youtube-nocookie.com/embed/abc", "Google"],
  ["Twitch", "https://player.twitch.tv/?video=1", "Twitch (Amazon)"],
  ["Spotify", "https://open.spotify.com/embed/track/1", "Spotify"],
  ["Soundcloud", "https://w.soundcloud.com/player/?url=x", "SoundCloud"],
  ["Bandcamp", "https://bandcamp.com/EmbeddedPlayer/album=1", "Bandcamp"],
  ["Streamable", "https://streamable.com/e/abc?loop=0", "Streamable"],
];

beforeEach(() => {
  localStorage.clear();
  setAlwaysLoadMediaPlayers(false);
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

describe("players from other sites", () => {
  for (const [type, url, company] of providers) {
    it(`${type}: no iframe before the click, iframe after it`, () => {
      mount(embed(type, url));
      expect(document.querySelector("iframe")).toBeNull();
      expect(document.body.textContent).toContain(
        `Loading this connects to ${company}. They get your IP address and may store cookies.`,
      );
      const link = document.querySelector("a")!;
      expect(link.getAttribute("href")).toBe(
        "https://zrzur.test/privacy#players",
      );
      expect(link.textContent).toBe("Privacy policy");
      expect(document.querySelector("button")!.getAttribute("aria-label")).toBe(
        `Load ${type === "Soundcloud" ? "SoundCloud" : type} player: A video`,
      );
      // the only picture is our proxy's
      const img = document.querySelector("img")!;
      expect(img.src).toBe("https://proxy.test/proxy?url=thumb");
      document.querySelector("button")!.click();
      expect(document.querySelector("iframe")!.getAttribute("src")).toBe(url);
    });
  }

  it("setting on: the player loads at once, without a placeholder", () => {
    setAlwaysLoadMediaPlayers(true);
    mount(embed("YouTube", "https://www.youtube-nocookie.com/embed/abc"));
    expect(document.querySelector("iframe")).not.toBeNull();
    expect(document.querySelector("button")).toBeNull();
  });

  it("is off by default on a fresh start and written on change", async () => {
    localStorage.clear();
    vi.resetModules();
    const fresh =
      await import("../components/ui/components/features/messaging/elements/embedSettings");
    expect(fresh.alwaysLoadMediaPlayers()).toBe(false);
    fresh.setAlwaysLoadMediaPlayers(true);
    expect(localStorage.getItem("zrzur:always-load-media-players")).toBe("1");
    // a new page load reads the stored choice back
    vi.resetModules();
    const again =
      await import("../components/ui/components/features/messaging/elements/embedSettings");
    expect(again.alwaysLoadMediaPlayers()).toBe(true);
    again.setAlwaysLoadMediaPlayers(false);
    expect(again.alwaysLoadMediaPlayers()).toBe(false);
  });

  it("Apple Music: placeholder, then an Apple embed address", () => {
    const apple = {
      specialContent: { type: "AppleMusic", album_id: "123", track_id: "456" },
      title: "A song",
      siteName: "Apple Music",
    } as never;
    mount(apple);
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.body.textContent).toContain(
      "Loading this connects to Apple.",
    );
    document.querySelector("button")!.click();
    expect(document.querySelector("iframe")!.getAttribute("src")).toBe(
      "https://embed.music.apple.com/us/album/123?i=456",
    );
  });

  it("privacy link: players section on the fallback and on server pages", () => {
    expect(playersPolicyUrl(undefined)).toBe(FALLBACK_POLICY);
    expect(FALLBACK_POLICY.endsWith("#players")).toBe(true);
    expect(playersPolicyUrl("https://x.test/privacy")).toBe(
      "https://x.test/privacy#players",
    );
    expect(playersPolicyUrl("https://x.test/privacy#data")).toBe(
      "https://x.test/privacy#data",
    );
  });

  it("Lightspeed and unknown types are normal links, not players", () => {
    expect(isPlayerEmbed("Lightspeed")).toBe(false);
    expect(isPlayerEmbed("None")).toBe(false);
    expect(isPlayerEmbed(undefined)).toBe(false);
    for (const type of [
      "YouTube",
      "Twitch",
      "Spotify",
      "Soundcloud",
      "Bandcamp",
    ])
      expect(isPlayerEmbed(type)).toBe(true);
  });
});
