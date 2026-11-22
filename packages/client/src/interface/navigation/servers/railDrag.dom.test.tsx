import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addLongPressListener } from "@revolt/ui/directives/longPress";

import {
  TOUCH_HOLD_MS,
  TOUCH_MENU_MS,
  createRailDrag,
  edgeScrollStep,
} from "./railDrag";

vi.mock("@lingui/solid/macro", () => ({ useLingui: () => ({ t: String }) }));
// the macro is compiled to this hook; a message descriptor reads as its text
vi.mock("@lingui/solid", () => {
  const text = (d: unknown) =>
    typeof d === "string" ? d : ((d as { message?: string }).message ?? "");
  return { useLingui: () => ({ t: text, _: text, i18n: { _: text } }) };
});

// jsdom has no PointerEvent: a mouse event with the pointer fields will do
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

type Drag = ReturnType<typeof createRailDrag>;

let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/**
 * Two servers stacked in a rail, each 48 px tall with an 8 px gap
 */
function mount() {
  const rail = document.createElement("div");
  document.body.appendChild(rail);

  const rows = new Map<string, HTMLElement>();
  const layout: Record<string, number> = { a: 0, b: 56, c: 112 };
  for (const id of ["a", "b", "c"]) {
    const el = document.createElement("div");
    el.dataset.id = id;
    const link = document.createElement("a");
    link.href = `/server/${id}`;
    el.appendChild(link);
    el.getBoundingClientRect = () =>
      ({
        top: layout[id],
        bottom: layout[id] + 48,
        left: 12,
        right: 60,
        height: 48,
        width: 48,
      }) as DOMRect;
    rail.appendChild(el);
    rows.set(id, el);
  }
  rail.getBoundingClientRect = () =>
    ({ top: 0, bottom: 400, left: 0, right: 72, height: 400 }) as DOMRect;

  const onMove = vi.fn();
  const onFold = vi.fn();
  let drag!: Drag;

  createRoot((done) => {
    dispose = done;
    drag = createRailDrag({
      entries: () => [
        { id: "a", kind: "server" },
        { id: "b", kind: "server" },
        { id: "c", kind: "server" },
      ],
      container: () => rail,
      onMove,
      onFold,
    });
    for (const [id, el] of rows) drag.register(id, el);
  });

  return { drag, rows, onMove, onFold };
}

function pointer(
  type: string,
  x: number,
  y: number,
  pointerType: "touch" | "mouse" | "pen" = "touch",
) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerType,
    pointerId: pointerType === "mouse" ? 1 : 7,
    isPrimary: true,
    button: 0,
  });
}

/** Press on an entry the way the rail does (the element sees it first) */
function press(
  drag: Drag,
  el: HTMLElement,
  id: string,
  x: number,
  y: number,
  pointerType: "touch" | "mouse" | "pen" = "touch",
) {
  const event = pointer("pointerdown", x, y, pointerType);
  el.dispatchEvent(event);
  drag.press(id, event);
  return event;
}

function touchMove(el: HTMLElement) {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe("rail drag with a finger", () => {
  it("a short tap does not drag and lets the link open", () => {
    const { drag, rows, onMove } = mount();
    const row = rows.get("a")!;
    press(drag, row, "a", 36, 24);

    vi.advanceTimersByTime(100);
    window.dispatchEvent(pointer("pointerup", 36, 24));

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    row.querySelector("a")!.dispatchEvent(click);

    expect(drag.dragging()).toBeUndefined();
    expect(drag.lifted()).toBeUndefined();
    expect(click.defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("moving before the hold ends is a scroll, not a drag", () => {
    const { drag, rows } = mount();
    const row = rows.get("a")!;
    press(drag, row, "a", 36, 24);

    window.dispatchEvent(pointer("pointermove", 36, 60));
    const move = touchMove(row);
    vi.advanceTimersByTime(TOUCH_MENU_MS + 100);

    expect(move.defaultPrevented).toBe(false);
    expect(drag.lifted()).toBeUndefined();
    expect(drag.dragging()).toBeUndefined();
  });

  it("a long press lifts the entry, then moving drags it and the drop reorders", () => {
    const { drag, rows, onMove } = mount();
    const row = rows.get("a")!;
    press(drag, row, "a", 36, 24);

    vi.advanceTimersByTime(TOUCH_HOLD_MS);
    expect(drag.lifted()).toBe("a");

    // the page must not scroll under the finger from here on
    expect(touchMove(row).defaultPrevented).toBe(true);

    window.dispatchEvent(pointer("pointermove", 36, 120));
    window.dispatchEvent(pointer("pointermove", 36, 165));
    expect(drag.dragging()).toBe("a");

    window.dispatchEvent(pointer("pointerup", 36, 165));
    expect(onMove).toHaveBeenCalledWith("a", undefined, undefined);
    expect(drag.dragging()).toBeUndefined();
    expect(drag.lifted()).toBeUndefined();
  });

  it("a long press without moving opens the app's menu and not the link", () => {
    const { drag, rows, onMove } = mount();
    const row = rows.get("b")!;
    const menu = vi.fn();
    row.addEventListener("contextmenu", menu);

    press(drag, row, "b", 36, 80);
    vi.advanceTimersByTime(TOUCH_MENU_MS);

    expect(menu).toHaveBeenCalledTimes(1);
    expect(drag.dragging()).toBeUndefined();

    window.dispatchEvent(pointer("pointerup", 36, 80));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    row.querySelector("a")!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("releasing a lifted entry without moving opens the menu once", () => {
    const { drag, rows } = mount();
    const row = rows.get("b")!;
    const menu = vi.fn();
    row.addEventListener("contextmenu", menu);

    press(drag, row, "b", 36, 80);
    vi.advanceTimersByTime(TOUCH_HOLD_MS + 20);
    window.dispatchEvent(pointer("pointerup", 36, 80));
    vi.advanceTimersByTime(TOUCH_MENU_MS);

    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("dragging after the menu opened closes it again and moves the entry", () => {
    const { drag, rows, onMove } = mount();
    const row = rows.get("a")!;
    const menu = vi.fn();
    row.addEventListener("contextmenu", menu);

    press(drag, row, "a", 36, 24);
    vi.advanceTimersByTime(TOUCH_MENU_MS + 200);
    expect(menu).toHaveBeenCalledTimes(1);

    window.dispatchEvent(pointer("pointermove", 36, 165));
    // a second menu event toggles the open menu shut
    expect(menu).toHaveBeenCalledTimes(2);
    expect(drag.dragging()).toBe("a");

    window.dispatchEvent(pointer("pointerup", 36, 165));
    expect(onMove).toHaveBeenCalledWith("a", undefined, undefined);
  });

  it("keeps the browser's own long-press menu away while a finger is down", () => {
    const { drag, rows } = mount();
    const row = rows.get("a")!;
    const menu = vi.fn();
    row.addEventListener("contextmenu", menu);

    press(drag, row, "a", 36, 24);
    // what Android sends on a long press
    const native = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    row.dispatchEvent(native);

    expect(native.defaultPrevented).toBe(true);
    expect(menu).not.toHaveBeenCalled();
  });

  it("claims the press so the shared long-press menu does not fire as well", () => {
    const { drag, rows } = mount();
    const row = rows.get("a")!;
    const shared = vi.fn();
    const stop = addLongPressListener(row, shared);

    press(drag, row, "a", 36, 24);
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(pointer("pointerup", 36, 24));

    expect(shared).not.toHaveBeenCalled();
    stop();
  });

  it("still holds the page when the touched node is redrawn mid-press", () => {
    const { drag, rows } = mount();
    const row = rows.get("a")!;
    const icon = document.createElement("span");
    row.querySelector("a")!.appendChild(icon);

    // the finger lands on the icon inside the entry
    const down = pointer("pointerdown", 36, 24);
    icon.dispatchEvent(down);
    drag.press("a", down);
    vi.advanceTimersByTime(TOUCH_HOLD_MS);

    // the icon is replaced (a menu opening or closing redraws it): touch
    // events keep going to the old node, which no longer reaches the entry
    icon.remove();
    expect(touchMove(icon).defaultPrevented).toBe(true);
  });

  it("a cancelled touch puts the entry back without a drop", () => {
    const { drag, rows, onMove } = mount();
    const row = rows.get("a")!;
    press(drag, row, "a", 36, 24);
    vi.advanceTimersByTime(TOUCH_HOLD_MS);
    window.dispatchEvent(pointer("pointermove", 36, 165));
    window.dispatchEvent(pointer("pointercancel", 36, 165));

    expect(onMove).not.toHaveBeenCalled();
    expect(drag.dragging()).toBeUndefined();
  });
});

describe("rail drag with a pen", () => {
  it("an Apple Pencil rests to lift, like a finger", () => {
    const { drag, rows, onMove } = mount();
    press(drag, rows.get("c")!, "c", 36, 130, "pen");
    // a pen that moves at once scrolls; resting lifts
    vi.advanceTimersByTime(TOUCH_HOLD_MS);
    expect(drag.lifted()).toBe("c");

    window.dispatchEvent(pointer("pointermove", 36, 60, "pen"));
    window.dispatchEvent(pointer("pointermove", 36, 4, "pen"));
    window.dispatchEvent(pointer("pointerup", 36, 4, "pen"));
    expect(onMove).toHaveBeenCalledWith("c", "a", undefined);
  });
});

describe("rail drag with a mouse", () => {
  it("drags at once after a few pixels and still reorders", () => {
    const { drag, rows, onMove } = mount();
    press(drag, rows.get("c")!, "c", 36, 130, "mouse");

    window.dispatchEvent(pointer("pointermove", 36, 120, "mouse"));
    window.dispatchEvent(pointer("pointermove", 36, 4, "mouse"));
    expect(drag.dragging()).toBe("c");

    window.dispatchEvent(pointer("pointerup", 36, 4, "mouse"));
    expect(onMove).toHaveBeenCalledWith("c", "a", undefined);
  });

  it("leaves right-click to the app's menu while not dragging", () => {
    const { drag, rows } = mount();
    const row = rows.get("a")!;
    press(drag, row, "a", 36, 24, "mouse");
    window.dispatchEvent(pointer("pointerup", 36, 24, "mouse"));

    const native = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    const menu = vi.fn();
    row.addEventListener("contextmenu", menu);
    row.dispatchEvent(native);
    expect(menu).toHaveBeenCalledTimes(1);
  });
});

describe("edge scrolling", () => {
  it("scrolls up near the top, down near the bottom, not in between", () => {
    expect(edgeScrollStep(4, 0, 400)).toBeLessThan(0);
    expect(edgeScrollStep(396, 0, 400)).toBeGreaterThan(0);
    expect(edgeScrollStep(200, 0, 400)).toBe(0);
    // nearer the edge is faster
    expect(Math.abs(edgeScrollStep(2, 0, 400))).toBeGreaterThan(
      Math.abs(edgeScrollStep(30, 0, 400)),
    );
  });
});
