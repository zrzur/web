import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The player card sits inside the link embed, which already shows the site
// name and the title: the card must not say them a second time. The privacy
// link is a real tap target next to "Load", not a word inside the sentence.

vi.mock("@revolt/client", () => ({ useClient: () => () => undefined }));
vi.mock("@revolt/ui/components/design", () => ({
  Button: (props: {
    children: unknown;
    "aria-label"?: string;
    onPress?: () => void;
  }) => (
    <button aria-label={props["aria-label"]} onClick={() => props.onPress?.()}>
      {props.children as never}
    </button>
  ),
}));
vi.mock("@revolt/ui/components/utils/mediaSize", () => ({
  fitMessageMedia: (width: number, height: number) => ({ width, height }),
}));
vi.mock("@revolt/ui/components/utils", () => ({
  SizedContent: (props: { children: unknown }) => (
    <div>{props.children as never}</div>
  ),
}));

import { SpecialEmbed } from "./SpecialEmbed";
import { allowMediaPlayer, setAlwaysLoadMediaPlayers } from "./embedSettings";

let dispose: (() => void) | undefined;

function setup(siteName: string | undefined) {
  const embed = {
    siteName,
    title: "Me at the zoo",
    // as the SDK builds it: autoplay off until the press
    embedURL:
      "https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?modestbranding=1&autoplay=0",
    specialContent: { type: "YouTube", id: "jNQXAC9IVRw" },
    video: { width: 1280, height: 720 },
  };
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <SpecialEmbed embed={embed as never} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return document.querySelector<HTMLElement>(
    '[data-testid="player-placeholder"]',
  )!;
}

const count = (root: HTMLElement, text: string) =>
  root.textContent!.split(text).length - 1;

beforeEach(() => {
  localStorage.clear();
  i18n.loadAndActivate({ locale: "en", messages: {} });
});
afterEach(() => dispose?.());

describe("SpecialEmbed placeholder", () => {
  it("does not repeat the site name and title the embed already shows", () => {
    const card = setup("YouTube");
    expect(count(card, "YouTube")).toBe(0);
    expect(count(card, "Me at the zoo")).toBe(0);
    // the button still says what it loads
    expect(card.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Load YouTube player: Me at the zoo",
    );
  });

  it("names the provider when the embed has no site name", () => {
    const card = setup(undefined);
    expect(count(card, "YouTube")).toBe(1);
    // the embed shows the title above the card
    expect(count(card, "Me at the zoo")).toBe(0);
  });

  it("puts the privacy link beside Load, outside the sentence", () => {
    const card = setup("YouTube");
    const link = card.querySelector("a")!;
    const button = card.querySelector("button")!;
    expect(link.textContent).toBe("Privacy policy");
    expect(link.parentElement).toBe(button.parentElement);
  });
});

// Nothing loads or plays by itself: not after a refresh, not for a site the
// reader allowed before, not with the notice turned off. One press plays.
describe("SpecialEmbed waits for a press", () => {
  afterEach(() => setAlwaysLoadMediaPlayers(false));

  it("an allowed site shows Play, not the player, after a refresh", () => {
    allowMediaPlayer("YouTube");
    const card = setup("YouTube");
    expect(card).not.toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    const button = card.querySelector("button")!;
    expect(button.textContent).toBe("Play");
    expect(button.getAttribute("aria-label")).toBe(
      "Play YouTube player: Me at the zoo",
    );
    // no notice and no policy link for a site already allowed
    expect(card.querySelector("a")).toBeNull();
  });

  it("with the notice skipped for every site, still no player until a press", () => {
    setAlwaysLoadMediaPlayers(true);
    setup("YouTube");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("a press loads the player and starts it", () => {
    const card = setup("YouTube");
    card.querySelector("button")!.click();
    const frame = document.querySelector("iframe")!;
    expect(frame).not.toBeNull();
    expect(new URL(frame.src).searchParams.get("autoplay")).toBe("1");
    expect(frame.getAttribute("allow")).toContain("autoplay");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-forms");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });
});
