import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileFrame } from "./ProfileFrame";

vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ mediaUrl: "http://media.test" }),
}));
vi.mock("../NameplateMotion", () => ({ useDesignMotion: () => () => true }));

let dispose: (() => void) | undefined;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  // jsdom lays nothing out: the card is 360 x 600
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 360,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 600,
  });
});
afterEach(() => dispose?.());

const layer = () =>
  document.querySelector<HTMLElement>("[data-profile-frame]")!;

describe("a frame drawn ahead of time", () => {
  it("loads its own file and is drawn round the card; another one replaces it", async () => {
    const [frame, setFrame] = createSignal("zrzur-flock");
    dispose = render(
      () => <ProfileFrame frame={frame()} />,
      document.getElementById("root")!,
    );
    // each frame is its own lazy file: on a busy machine the import takes
    // longer than waitFor's default second
    await vi.waitFor(
      () =>
        expect(layer().querySelectorAll("svg path").length).toBeGreaterThan(20),
      { timeout: 10_000 },
    );
    // the starlings have nothing that twinkles
    expect(layer().dataset.moving).toBeUndefined();
    const flock = layer().innerHTML;

    setFrame("coral-reef");
    await vi.waitFor(
      () => {
        expect(layer().dataset.profileFrame).toBe("coral-reef");
        expect(layer().innerHTML).not.toBe(flock);
        expect(layer().querySelector(".z-frame-twinkle")).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    // bubbles twinkle while the viewer sees motion
    expect(layer().dataset.moving).toBe("");
    const art = layer().querySelector<HTMLElement>("svg")!.parentElement!;
    expect(art.style.left).toBe("-56px");
    expect(art.style.top).toBe("-96px");
  });
});
