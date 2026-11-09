/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { createComputed, createRoot, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { css } from "styled-system/css";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerFloatingElement,
  unregisterFloatingElement,
} from "../../directives/floating";

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
const presences = { count: 0 };
vi.mock("@revolt/ui/motion", async () => {
  const { Show } = await import("solid-js");
  return {
    useMotion: () => ({ play: () => Promise.resolve(), duration: () => 0 }),
    MotionPresence: (props: any) => (
      presences.count++,
      (
        <Show when={props.when}>
          {typeof props.children === "function"
            ? props.children(() => props.when)
            : props.children}
        </Show>
      )
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
    unregisterFloatingElement(anchor);
  });
});

describe("the floating layer", () => {
  it("does no work for elements that never open (hundreds sit in the server list and the messages)", async () => {
    presences.count = 0;
    const anchors = Array.from({ length: 400 }, () => {
      const anchor = document.createElement("button");
      document.body.append(anchor);
      registerFloatingElement({
        config: () => ({}) as never,
        element: anchor,
        hide: () => undefined,
        show: () => undefined,
      });
      return anchor;
    });
    dispose = render(() => <FloatingManager />, document.body);
    await new Promise((r) => setTimeout(r, 20));
    expect(presences.count).toBe(0);

    // one opens: only that one is drawn, also after it closes and opens again
    const opener = document.createElement("a");
    document.body.append(opener);
    const [show, setShow] = createSignal<any>();
    registerFloatingElement({
      config: () => ({}) as never,
      element: opener,
      hide: () => setShow(undefined),
      show,
    });
    setShow({ tooltip: { content: "Opened once", placement: "top" } });
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector("#floating")!.textContent).toContain(
      "Opened once",
    );
    setShow(undefined);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector("#floating")!.textContent).not.toContain(
      "Opened once",
    );
    setShow({ tooltip: { content: "Opened twice", placement: "top" } });
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector("#floating")!.textContent).toContain(
      "Opened twice",
    );
    expect(presences.count).toBe(1);

    // leaving the page takes its popup away
    unregisterFloatingElement(opener);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector("#floating")!.textContent).not.toContain(
      "Opened twice",
    );
    for (const anchor of anchors) unregisterFloatingElement(anchor);
  });

  it("does not tie the computation that unregisters to the layer's list", () => {
    const gone = document.createElement("span");
    const [show] = createSignal<any>({ tooltip: { content: "x" } });
    registerFloatingElement({
      config: () => ({}) as never,
      element: gone,
      hide: () => undefined,
      show,
    });
    let runs = 0;
    const stop = createRoot((dispose) => {
      createComputed(() => {
        runs++;
        unregisterFloatingElement(gone);
      });
      return dispose;
    });
    expect(runs).toBe(1);
    // another element opens: the list changes
    const other = document.createElement("span");
    registerFloatingElement({
      config: () => ({}) as never,
      element: other,
      hide: () => undefined,
      show,
    });
    expect(runs).toBe(1);
    unregisterFloatingElement(other);
    stop();
  });
});
