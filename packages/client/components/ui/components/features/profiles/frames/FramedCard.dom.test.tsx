import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FramedCard } from "./ProfileFrame";
import { framePadding, readFrameRoom } from "./frameRoom";

vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ mediaUrl: "http://media.test" }),
}));
vi.mock("../NameplateMotion", () => ({ useDesignMotion: () => () => false }));

const FRAME = "c:01M5TGZFE80SKMC8JVGJKBHS2A";

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
});
afterEach(() => dispose?.());

function mount(props: { frame?: string; file?: string; fit?: boolean }) {
  // jsdom lays nothing out: the card is 340 px wide
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 340,
  });
  dispose = render(
    () => (
      <FramedCard frame={props.frame} file={props.file} fit={props.fit}>
        <div role="dialog" />
      </FramedCard>
    ),
    document.getElementById("root")!,
  );
  return document.querySelector<HTMLElement>("[data-frame-host]")!;
}

describe("a framed profile says the room its frame takes", () => {
  it("a creator's frame: the template's room, and popups keep it clear", () => {
    const host = mount({ frame: FRAME, file: "f1", fit: true });
    expect(host.hasAttribute("data-framed")).toBe(true);
    expect(readFrameRoom(host)).toEqual({ x: 30, top: 70, bottom: 40 });
    expect(host.style.getPropertyValue("--z-frame-top")).toBe("70px");
    // what FloatingManager reads off the popup that holds the card
    const popup = host.parentElement!;
    expect(framePadding(readFrameRoom(popup))).toEqual({
      top: 82,
      bottom: 52,
      left: 42,
      right: 42,
    });
  });

  it("a built-in frame no longer shipped: no frame at all", () => {
    for (const frame of ["crystal", "zrzur-neon"]) {
      const host = mount({ frame, fit: true });
      expect(host.hasAttribute("data-framed")).toBe(false);
      expect(host.hasAttribute("data-frame-room")).toBe(false);
      expect(host.querySelector("[data-profile-frame]")).toBeNull();
      dispose?.();
    }
  });

  it("says nothing without a frame, or outside the window (previews)", () => {
    let host = mount({ fit: true });
    expect(host.hasAttribute("data-frame-room")).toBe(false);
    expect(readFrameRoom(host)).toEqual({ x: 0, top: 0, bottom: 0 });
    expect(framePadding(readFrameRoom(host))).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
    dispose?.();
    host = mount({ frame: FRAME });
    expect(host.hasAttribute("data-frame-room")).toBe(false);
    expect(host.style.getPropertyValue("--z-frame-top")).toBe("");
  });
});
