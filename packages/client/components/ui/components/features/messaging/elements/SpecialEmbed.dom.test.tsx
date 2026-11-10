import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The player card sits inside the link embed, which already shows the site
// name and the title: the card must not say them a second time. The privacy
// link is a real tap target next to "Load", not a word inside the sentence.

vi.mock("@revolt/client", () => ({ useClient: () => () => undefined }));
vi.mock("@revolt/ui/components/design", () => ({
  Button: (props: { children: unknown; "aria-label"?: string }) => (
    <button aria-label={props["aria-label"]}>{props.children as never}</button>
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

let dispose: (() => void) | undefined;

function setup(siteName: string | undefined) {
  const embed = {
    siteName,
    title: "Me at the zoo",
    embedURL: "https://www.youtube-nocookie.com/embed/jNQXAC9IVRw",
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
