/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { css } from "styled-system/css";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFloatingElement } from "../../directives/floating";

import { FloatingManager } from "./FloatingManager";

// the parts a tooltip does not use pull in the whole app
vi.mock("../design", () => ({ typography: { raw: () => ({}) } }));
vi.mock("./UserCard", () => ({ UserCard: () => null }));
vi.mock("./AutoComplete", () => ({ AutoComplete: () => null }));
vi.mock("@revolt/keybinds", () => ({
  Keybind: () => null,
  KeybindAction: { CLOSE_FLOATING: "close" },
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({ motion: { resolve: () => undefined } }),
}));
vi.mock("@revolt/ui/motion", async () => {
  const { Show } = await import("solid-js");
  return {
    useMotion: () => ({ play: () => Promise.resolve(), duration: () => 0 }),
    MotionPresence: (props: any) => (
      <Show when={props.when}>
        {typeof props.children === "function"
          ? props.children(() => props.when)
          : props.children}
      </Show>
    ),
  };
});

let dispose: (() => void) | undefined;

beforeEach(() => {
  document.body.innerHTML = '<div id="floating"></div><div id="root"></div>';
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
afterEach(() => dispose?.());

describe("tooltips", () => {
  it("never take clicks: the box around the text ignores the pointer", async () => {
    const anchor = document.createElement("a");
    document.body.append(anchor);
    const [show] = createSignal<any>({
      tooltip: {
        content: "You have 1 pending friend request.",
        placement: "right",
      },
    });
    registerFloatingElement({
      config: () => ({}) as never,
      element: anchor,
      hide: () => undefined,
      show,
    });
    dispose = render(() => <FloatingManager />, document.body);
    await new Promise((r) => setTimeout(r, 20));
    const text = [...document.querySelectorAll("#floating div")].find(
      (el) =>
        el.textContent === "You have 1 pending friend request." &&
        !el.children.length,
    )!;
    expect(text).toBeTruthy();
    // the positioned box that wraps the tooltip text
    const box = text.parentElement as HTMLElement;
    expect(box.style.position).toBe("fixed");
    expect(box.classList.contains(css({ pointerEvents: "none" }))).toBe(true);
  });
});
