import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileFrame } from "./ProfileFrame";

let motion = true;
vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ mediaUrl: "http://media.test" }),
}));
vi.mock("../NameplateMotion", () => ({
  useDesignMotion: () => () => motion,
}));

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
  // jsdom lays nothing out: the card is 340 x 400 px
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 340,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 400,
  });
});
afterEach(() => dispose?.());

/** the picture a community frame is drawn with */
function source(props: { file?: string; url?: string }) {
  dispose = render(
    () => <ProfileFrame frame="c:01ARZ3NDEKTSV4RRFFQ69G5FAV" {...props} />,
    document.getElementById("root")!,
  );
  const picture = document.querySelector<HTMLElement>(
    "[data-profile-frame] > div",
  );
  return picture?.style.getPropertyValue("border-image-source");
}

describe("a creator's frame that moves", () => {
  it("plays the file for anyone who sees motion", () => {
    motion = true;
    expect(source({ file: "frame1" })).toBe(
      'url("http://media.test/decorations/frame1/original")',
    );
  });

  it("is a still with reduced motion, Save data or effects off", () => {
    motion = false;
    // the media server's still: the moving file is never fetched
    expect(source({ file: "frame1" })).toBe(
      'url("http://media.test/decorations/frame1")',
    );
  });

  it("cuts the still in the same places as the file", () => {
    motion = false;
    source({ file: "frame1" });
    const picture = document.querySelector<HTMLElement>(
      "[data-profile-frame] > div",
    )!;
    expect(picture.style.getPropertyValue("border-image-slice")).toBe(
      "21.5686% 10% 9.8039% 10%",
    );
  });
});
