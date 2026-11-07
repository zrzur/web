/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionPresence } from "./MotionPresence";

vi.mock("@revolt/state", () => ({
  useState: () => ({
    motion: {
      resolve: () => ({
        style: "fade",
        duration: 120,
        easing: "ease",
        direction: "up",
        origin: "center",
      }),
    },
  }),
}));

/**
 * Minimal Web Animations stand-in: runs for `duration`, `reverse()` turns it
 * round from where it is, `cancel()` rejects `finished`.
 */
function fakeAnimate(this: Element, _keyframes: unknown, options: any) {
  let rate = 1;
  let elapsed = 0;
  let last = performance.now();
  let resolve!: () => void;
  const anim: any = {
    playState: "running",
    finished: undefined as Promise<void> | undefined,
    reverse() {
      elapsed += (performance.now() - last) * rate;
      last = performance.now();
      rate = -rate;
      schedule();
    },
    cancel() {
      anim.playState = "idle";
    },
  };
  let timer: ReturnType<typeof setTimeout>;
  function schedule() {
    clearTimeout(timer);
    const left = rate > 0 ? options.duration - elapsed : elapsed;
    timer = setTimeout(
      () => {
        anim.playState = "finished";
        resolve();
      },
      Math.max(0, left),
    );
  }
  anim.finished = new Promise<void>((r) => (resolve = r));
  schedule();
  return anim;
}

let dispose: (() => void) | undefined;
beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  (Element.prototype as any).animate = fakeAnimate;
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  delete (Element.prototype as any).animate;
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("MotionPresence", () => {
  it("unmounts after opening and closing in the same frame", async () => {
    const [open, setOpen] = createSignal(false);
    dispose = render(
      () => (
        <MotionPresence when={open()} area="popouts">
          <div data-menu />
        </MotionPresence>
      ),
      document.getElementById("root")!,
    );
    for (let i = 0; i < 3; i++) {
      setOpen(true);
      setOpen(false);
    }
    await wait(60);
    setOpen(true);
    await wait(10);
    setOpen(false);
    await wait(400);
    expect(document.querySelectorAll("[data-menu]").length).toBe(0);
  });

  it("an exiting element ignores the pointer, then is removed", async () => {
    const [open, setOpen] = createSignal(true);
    dispose = render(
      () => (
        <MotionPresence when={open()} area="popouts" appear={false}>
          <div data-menu />
        </MotionPresence>
      ),
      document.getElementById("root")!,
    );
    const el = document.querySelector<HTMLElement>("[data-menu]")!;
    setOpen(false);
    expect(el.style.pointerEvents).toBe("none");
    await wait(300);
    expect(document.querySelectorAll("[data-menu]").length).toBe(0);
  });
});
