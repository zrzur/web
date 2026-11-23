import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/common", () => ({
  useDevice: () => ({ layout: () => "phone" }),
}));

import { SlideDrawer, SlideState } from "./SlideDrawer";

/** One finger on the screen */
function touch(
  root: HTMLElement,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  x: number,
  y = 300,
) {
  const point = { identifier: 0, screenX: x, screenY: y };
  const event = new Event(type, { bubbles: true, cancelable: true });
  const down = type === "touchend" || type === "touchcancel" ? [] : [point];
  Object.assign(event, { touches: down, changedTouches: [point] });
  root.dispatchEvent(event);
}

describe("the phone's slide between the lists and the page", () => {
  let root: HTMLElement;
  let page: HTMLElement;
  let drawer: SlideDrawer;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement("div");
    page = document.createElement("div");
    root.append(page);
    document.body.append(root);
    // the lists are on screen, the page is aside
    drawer = new SlideDrawer(page, root, false);
    drawer.enabled = true;
    expect(drawer.state).toBe(SlideState.HIDDEN);
  });

  afterEach(() => {
    drawer.delete();
    root.remove();
    vi.useRealTimers();
  });

  it("a press brings the page on screen", () => {
    expect(drawer.setShown(true)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.SHOWN);
  });

  it("a swipe the system took over does not hold the drawer", () => {
    // the page is on screen; a swipe toward the lists starts...
    drawer.setShown(true);
    vi.advanceTimersByTime(400);
    touch(root, "touchstart", 40);
    touch(root, "touchmove", 60);
    touch(root, "touchmove", 90);
    expect(drawer.state).toBe(SlideState.MOVING);
    // ...and the system takes it (its own back swipe): no end follows
    touch(root, "touchcancel", 90);
    vi.advanceTimersByTime(400);
    // back where it was, and a press works again
    expect(drawer.state).toBe(SlideState.SHOWN);
    expect(drawer.setShown(false)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.HIDDEN);
    expect(drawer.setShown(true)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.SHOWN);
  });

  it("lets go of a touch once a row under it lifts for a drag", () => {
    drawer.setShown(true);
    vi.advanceTimersByTime(400);
    touch(root, "touchstart", 40);
    // a finger rested on a channel: the list lifts it (touchHold)
    root.dispatchEvent(new Event("touchhold", { bubbles: true }));
    touch(root, "touchmove", 60);
    touch(root, "touchmove", 120);
    expect(drawer.state).toBe(SlideState.SHOWN);
  });

  it("a touch whose end was lost is dropped by the next finger", () => {
    drawer.setShown(true);
    vi.advanceTimersByTime(400);
    touch(root, "touchstart", 40);
    touch(root, "touchmove", 90);
    // no end and no cancel at all (the finger left the window)
    touch(root, "touchstart", 200);
    touch(root, "touchend", 200);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.SHOWN);
    expect(drawer.setShown(false)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.HIDDEN);
  });

  it("a press while the last slide is still settling follows on", () => {
    drawer.setShown(true);
    // the slide has started and is not finished
    vi.advanceTimersByTime(60);
    expect(drawer.setShown(false)).toBe(true);
    vi.advanceTimersByTime(600);
    expect(drawer.state).toBe(SlideState.HIDDEN);
  });

  it("locked to the lists: no press or swipe shows the page, a kept press follows the unlock", () => {
    drawer.locked = true;
    // a press on a row asks for the page just before the address changes
    expect(drawer.setShown(true)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.HIDDEN);
    // a swipe toward the page goes nowhere
    touch(root, "touchstart", 300);
    touch(root, "touchmove", 200);
    touch(root, "touchmove", 100);
    touch(root, "touchend", 100);
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.HIDDEN);
    // the address changed: the page has something to show
    drawer.setShown(true);
    drawer.locked = false;
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.SHOWN);
    // back at the lists' address: the lists come back by themselves
    drawer.locked = true;
    vi.advanceTimersByTime(400);
    expect(drawer.state).toBe(SlideState.HIDDEN);
  });
});
