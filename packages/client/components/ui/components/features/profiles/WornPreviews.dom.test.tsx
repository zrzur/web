import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WornEffect, WornName, wearsNameStyle } from "./WornPreviews";

let motion = true;

vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ mediaUrl: "http://media.test" }),
}));
vi.mock("./NameplateMotion", () => ({
  useDesignMotion: () => () => motion,
}));
vi.mock("../../design", () => ({
  Avatar: (props: { fallback?: string }) => <i data-avatar>{props.fallback}</i>,
}));
vi.mock("./AvatarDecoration", () => ({
  AvatarDecoration: (props: { children: JSX.Element }) => <>{props.children}</>,
}));
vi.mock("./frames/ProfileFrame", () => ({
  FramedCard: (props: { children: JSX.Element }) => <>{props.children}</>,
}));
// an animated file is not played in jsdom: the play is marked only
vi.mock("./effects/ProfileEffect", async () => {
  const { Show } = await import("solid-js");
  return {
    ProfileEffect: (props: { effect?: string; idle?: unknown }) => (
      <Show when={motion && props.effect} fallback={props.idle as never}>
        <i data-testid="profile-effect" data-effect={props.effect} />
      </Show>
    ),
  };
});

let dispose: (() => void) | undefined;
let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  motion = true;
  document.body.innerHTML = '<div id="root"></div>';
  seen = undefined;
  globalThis.IntersectionObserver = class {
    constructor(callback: typeof seen) {
      seen = callback;
    }
    observe() {}
    disconnect() {}
  } as never;
});
afterEach(() => {
  dispose?.();
  vi.useRealTimers();
});

function mountEffect() {
  dispose = render(
    () => (
      <button type="button">
        <WornEffect
          look={{ effect: "c:01ARZ3NDEKTSV4RRFFQ69G5FAV", effect_file: "e1" }}
        />
      </button>
    ),
    document.getElementById("root")!,
  );
  const tile = document.querySelector("button")!;
  return {
    tile,
    playing: () => !!tile.querySelector("[data-testid='profile-effect']"),
    // the media server's still of the creator's effect
    still: () =>
      tile.querySelector("img")?.getAttribute("src") ===
      "http://media.test/effects/e1",
  };
}

describe("an effect in its Wearing tile", () => {
  it("rests on a still until the tile is seen, then plays once", () => {
    const tile = mountEffect();
    expect(tile.still()).toBe(true);
    expect(tile.playing()).toBe(false);
    seen?.([{ isIntersecting: true }]);
    expect(tile.playing()).toBe(true);
    // one play (4 s) and a breath: back to the still
    vi.advanceTimersByTime(4700);
    expect(tile.playing()).toBe(false);
    expect(tile.still()).toBe(true);
  });

  it("plays again and again while the pointer rests on the tile", () => {
    const tile = mountEffect();
    tile.tile.dispatchEvent(new Event("pointerenter"));
    expect(tile.playing()).toBe(true);
    vi.advanceTimersByTime(4700 * 3);
    expect(tile.playing()).toBe(true);
    tile.tile.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(4700);
    expect(tile.playing()).toBe(false);
  });

  it("with reduced motion (or the app's own switch) shows only the still", () => {
    motion = false;
    const tile = mountEffect();
    seen?.([{ isIntersecting: true }]);
    tile.tile.dispatchEvent(new Event("pointerenter"));
    expect(tile.playing()).toBe(false);
    expect(tile.still()).toBe(true);
  });
});

describe("a name style in its Wearing tile", () => {
  it("is the person's own name, in its own font", () => {
    dispose = render(
      () => (
        <WornName
          look={{ name_font: "serif", name_colour: ["#ff7aa8"] }}
          wearer={{ name: "Layla Haddad" }}
        />
      ),
      document.getElementById("root")!,
    );
    const word = document.querySelector("[data-worn='name'] span")!;
    expect(word.textContent).toBe("Layla Haddad");
    expect((word as HTMLElement).style.fontFamily).toContain("Georgia");
  });

  it("is a tile only when something was chosen", () => {
    expect(wearsNameStyle(undefined)).toBe(false);
    expect(wearsNameStyle({ name_font: "default" })).toBe(false);
    expect(wearsNameStyle({ name_font: "kufi" })).toBe(true);
    expect(wearsNameStyle({ name_colour: ["#ff7aa8"] })).toBe(true);
    expect(wearsNameStyle({ name_effect: "halo" })).toBe(true);
  });
});
