import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FramedCard } from "./ProfileFrame";
import { framePadding, readFrameRoom } from "./frameRoom";

vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ mediaUrl: "http://media.test" }),
}));
vi.mock("../NameplateMotion", () => ({ useDesignMotion: () => () => false }));
// the drawing itself is not under test here
vi.mock("./builtinFrames", () => ({
  profileFrameSvg: () => ({ svg: "", room: { x: 0, top: 0, bottom: 0 } }),
}));

let dispose: (() => void) | undefined;
let phone = false;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  phone = false;
  window.matchMedia = (() => ({
    matches: phone,
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

function mount(props: { frame?: string; fit?: boolean }, tall: number) {
  Object.defineProperty(window, "innerHeight", {
    value: tall,
    configurable: true,
  });
  // jsdom lays nothing out: the card is 360 px wide
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 360,
  });
  dispose = render(
    () => (
      <FramedCard frame={props.frame} fit={props.fit}>
        <div role="dialog" />
      </FramedCard>
    ),
    document.getElementById("root")!,
  );
  return document.querySelector<HTMLElement>("[data-frame-host]")!;
}

describe("a framed profile says the room its frame takes", () => {
  it("on a 1200 px window: 4 px pixels, the full room", () => {
    const host = mount({ frame: "crystal", fit: true }, 1200);
    expect(host.dataset.frameCell).toBe("4");
    expect(readFrameRoom(host)).toEqual({ x: 56, top: 96, bottom: 72 });
    expect(host.style.getPropertyValue("--z-frame-top")).toBe("96px");
  });

  it("on an 800 px window: 3 px pixels, and popups keep that clear", () => {
    const host = mount({ frame: "crystal", fit: true }, 800);
    expect(host.dataset.frameCell).toBe("3");
    expect(readFrameRoom(host)).toEqual({ x: 42, top: 72, bottom: 54 });
    // what FloatingManager reads off the popup that holds the card
    const popup = host.parentElement!;
    expect(framePadding(readFrameRoom(popup))).toEqual({
      top: 84,
      bottom: 66,
      left: 54,
      right: 54,
    });
    expect(host.style.getPropertyValue("--z-frame-bottom")).toBe("54px");
  });

  it("on a phone: 2 px pixels", () => {
    phone = true;
    const host = mount({ frame: "crystal", fit: true }, 812);
    expect(host.dataset.frameCell).toBe("2");
    expect(readFrameRoom(host)).toEqual({ x: 28, top: 48, bottom: 36 });
  });

  it("says nothing without a frame, or outside the window (previews)", () => {
    let host = mount({ fit: true }, 700);
    expect(host.hasAttribute("data-frame-room")).toBe(false);
    expect(readFrameRoom(host)).toEqual({ x: 0, top: 0, bottom: 0 });
    expect(framePadding(readFrameRoom(host))).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
    dispose?.();
    host = mount({ frame: "crystal" }, 700);
    expect(host.hasAttribute("data-frame-room")).toBe(false);
    expect(host.style.getPropertyValue("--z-frame-top")).toBe("");
  });
});
