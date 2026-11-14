// The placeholder rows above and below a message list shimmer only while
// they are on screen. They used to animate all the time, out of sight above the
// messages: about a quarter of a processor core while the app only showed
// a channel.
import { render } from "solid-js/web";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Placeholders } from "./Placeholders";

type Callback = (entries: { isIntersecting: boolean }[]) => void;
let observers: { callback: Callback; disconnected: boolean }[] = [];
let dispose: (() => void) | undefined;

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: { callback: Callback; disconnected: boolean };
      constructor(callback: Callback) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <Placeholders align="end" side="older" />, host);
  const skeleton = host.firstElementChild as HTMLElement;
  const shimmer = () => skeleton.style.getPropertyValue("--skeleton-shimmer");
  const see = (isIntersecting: boolean) =>
    observers.forEach((o) => o.callback([{ isIntersecting }]));
  return { shimmer, see };
}

describe("message list skeleton", () => {
  it("does not animate while it is out of sight", () => {
    const { shimmer, see } = mount();
    expect(shimmer()).toBe("paused");
    see(false);
    expect(shimmer()).toBe("paused");
  });

  it("animates while it is on screen, and stops when it leaves", () => {
    const { shimmer, see } = mount();
    see(true);
    expect(shimmer()).toBe("running");
    see(false);
    expect(shimmer()).toBe("paused");
  });

  it("stops watching when it is taken down", () => {
    mount();
    expect(observers.length).toBeGreaterThan(0);
    dispose?.();
    dispose = undefined;
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });
});
