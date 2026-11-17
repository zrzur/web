import { describe, expect, it, vi } from "vitest";

import { sheetSwipe } from "./sheetSwipe";

/** a touch event carrying one finger at (x, y) */
const touch = (
  type: string,
  x: number,
  y: number,
  at: number,
  target: Element,
) => {
  const event = new Event(type, { bubbles: true }) as unknown as TouchEvent;
  const point = { clientX: x, clientY: y };
  Object.defineProperties(event, {
    touches: { value: type === "touchend" ? [] : [point] },
    changedTouches: { value: [point] },
    timeStamp: { value: at },
    target: { value: target },
  });
  return event;
};

const build = () => {
  const sheet = document.createElement("div");
  const list = document.createElement("div");
  const row = document.createElement("button");
  list.append(row);
  sheet.append(list);
  document.body.append(sheet);
  return { sheet, list, row };
};

describe("sheetSwipe: a bottom sheet closes by a pull down", () => {
  it("a long pull down closes the sheet, and the sheet follows the finger", () => {
    const { sheet, row } = build();
    const close = vi.fn();
    const swipe = sheetSwipe(() => sheet, close);
    swipe.onTouchStart(touch("touchstart", 100, 300, 0, row));
    swipe.onTouchMove(touch("touchmove", 100, 360, 200, row));
    expect(sheet.style.transform).toBe("translateY(60px)");
    swipe.onTouchMove(touch("touchmove", 100, 420, 400, row));
    swipe.onTouchEnd(touch("touchend", 100, 420, 600, row));
    expect(close).toHaveBeenCalledTimes(1);
    expect(sheet.style.transform).toBe("");
  });

  it("a short slow pull settles back and closes nothing", () => {
    const { sheet, row } = build();
    const close = vi.fn();
    const swipe = sheetSwipe(() => sheet, close);
    swipe.onTouchStart(touch("touchstart", 100, 300, 0, row));
    swipe.onTouchMove(touch("touchmove", 100, 350, 400, row));
    swipe.onTouchEnd(touch("touchend", 100, 350, 800, row));
    expect(close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe("");
  });

  it("a quick flick closes although it is short", () => {
    const { sheet, row } = build();
    const close = vi.fn();
    const swipe = sheetSwipe(() => sheet, close);
    swipe.onTouchStart(touch("touchstart", 100, 300, 0, row));
    swipe.onTouchMove(touch("touchmove", 100, 350, 40, row));
    swipe.onTouchEnd(touch("touchend", 100, 350, 50, row));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("content scrolled away from its top scrolls; the sheet does not move", () => {
    const { sheet, list, row } = build();
    Object.defineProperty(list, "scrollTop", { value: 120 });
    const close = vi.fn();
    const swipe = sheetSwipe(() => sheet, close);
    swipe.onTouchStart(touch("touchstart", 100, 300, 0, row));
    swipe.onTouchMove(touch("touchmove", 100, 460, 200, row));
    swipe.onTouchEnd(touch("touchend", 100, 460, 300, row));
    expect(close).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe("");
  });

  it("a sideways drag and a pull up are not a close", () => {
    const { sheet, row } = build();
    const close = vi.fn();
    const swipe = sheetSwipe(() => sheet, close);
    swipe.onTouchStart(touch("touchstart", 100, 300, 0, row));
    swipe.onTouchMove(touch("touchmove", 160, 310, 100, row));
    swipe.onTouchMove(touch("touchmove", 160, 460, 200, row));
    swipe.onTouchEnd(touch("touchend", 160, 460, 300, row));
    swipe.onTouchStart(touch("touchstart", 100, 300, 400, row));
    swipe.onTouchMove(touch("touchmove", 100, 250, 500, row));
    swipe.onTouchEnd(touch("touchend", 100, 250, 600, row));
    expect(close).not.toHaveBeenCalled();
  });

  it("does nothing while it is switched off, and a cancelled touch settles back", () => {
    const { sheet, row } = build();
    const close = vi.fn();
    const off = sheetSwipe(
      () => sheet,
      close,
      () => false,
    );
    off.onTouchStart(touch("touchstart", 100, 300, 0, row));
    off.onTouchMove(touch("touchmove", 100, 460, 200, row));
    off.onTouchEnd(touch("touchend", 100, 460, 300, row));
    expect(close).not.toHaveBeenCalled();

    const on = sheetSwipe(() => sheet, close);
    on.onTouchStart(touch("touchstart", 100, 300, 0, row));
    on.onTouchMove(touch("touchmove", 100, 460, 200, row));
    on.onTouchCancel();
    expect(sheet.style.transform).toBe("");
    expect(close).not.toHaveBeenCalled();
  });
});
