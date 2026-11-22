import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addLongPressListener } from "../../directives/longPress";

import { Draggable } from "./Draggable";
import { TOUCH_HOLD_MS, TOUCH_MENU_MS } from "./touchHold";

vi.mock("@lingui/solid/macro", () => ({ useLingui: () => ({ t: String }) }));
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

type Row = { id: string; name: string };

function mount(options: { touchHold?: boolean; disabled?: boolean } = {}) {
  const [items] = createSignal<Row[]>([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]);
  const host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => (
      <Draggable
        items={items()}
        onChange={() => undefined}
        touchHold={options.touchHold}
        disabled={options.disabled}
      >
        {({ item }) => (
          <div data-row={item.id}>
            <a href={`/channel/${item.id}`}>
              <span>{item.name}</span>
            </a>
          </div>
        )}
      </Draggable>
    ),
    host,
  );
  const row = (id: string) =>
    host.querySelector<HTMLElement>(`[data-row="${id}"]`)!;
  return { host, row };
}

function pointer(type: string, x: number, y: number, pointerType = "touch") {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerType,
    pointerId: 3,
    isPrimary: true,
  });
}

/** The real order of a finger: pointer down, then touch start */
function land(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(pointer("pointerdown", x, y));
  const start = new Event("touchstart", { bubbles: true, cancelable: true });
  el.dispatchEvent(start);
  return start;
}

describe("Draggable with a finger (touchHold)", () => {
  it("keeps the finger's own touch start from the drag zone", () => {
    const { row } = mount({ touchHold: true });
    const seen = vi.fn();
    row("a").addEventListener("touchstart", seen);

    land(row("a").querySelector("span")!, 20, 10);

    expect(seen).not.toHaveBeenCalled();
  });

  it("a long press, then a move, hands the drag to the drag zone", async () => {
    const { row } = mount({ touchHold: true });
    const seen: Event[] = [];
    row("a").addEventListener("touchstart", (e) => seen.push(e));

    land(row("a").querySelector("span")!, 20, 10);
    vi.advanceTimersByTime(TOUCH_HOLD_MS);
    expect(row("a").hasAttribute("data-lifted")).toBe(true);

    window.dispatchEvent(pointer("pointermove", 20, 30));
    await Promise.resolve();

    expect(seen).toHaveLength(1);
    const touches = (seen[0] as unknown as { touches: Touch[] }).touches;
    expect(touches[0].clientY).toBe(10);
    // still lifted until the drag zone takes the row
    expect(row("a").hasAttribute("data-lifted")).toBe(true);

    window.dispatchEvent(pointer("pointerup", 20, 30));
    expect(row("a").hasAttribute("data-lifted")).toBe(false);
  });

  it("moving before the hold ends is a scroll: no drag, no lift", async () => {
    const { row } = mount({ touchHold: true });
    const seen = vi.fn();
    row("a").addEventListener("touchstart", seen);

    land(row("a").querySelector("span")!, 20, 10);
    window.dispatchEvent(pointer("pointermove", 20, 40));
    vi.advanceTimersByTime(TOUCH_MENU_MS + 100);
    await Promise.resolve();

    expect(seen).not.toHaveBeenCalled();
    expect(row("a").hasAttribute("data-lifted")).toBe(false);
  });

  it("holding still opens the row's menu, not the link", () => {
    const { row } = mount({ touchHold: true });
    const menu = vi.fn();
    row("b").addEventListener("contextmenu", menu);

    land(row("b").querySelector("span")!, 20, 50);
    vi.advanceTimersByTime(TOUCH_MENU_MS);
    expect(menu).toHaveBeenCalledTimes(1);

    window.dispatchEvent(pointer("pointerup", 20, 50));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    row("b").querySelector("a")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("a short tap is left alone", () => {
    const { row } = mount({ touchHold: true });
    land(row("a").querySelector("span")!, 20, 10);
    vi.advanceTimersByTime(100);
    window.dispatchEvent(pointer("pointerup", 20, 10));

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    row("a").querySelector("a")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("the shared long-press menu does not fire as well", () => {
    const { row } = mount({ touchHold: true });
    const shared = vi.fn();
    const stop = addLongPressListener(row("a"), shared);

    land(row("a").querySelector("span")!, 20, 10);
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(pointer("pointerup", 20, 10));

    expect(shared).not.toHaveBeenCalled();
    stop();
  });

  it("does nothing while the list cannot be reordered", () => {
    const { row } = mount({ touchHold: true, disabled: true });
    const menu = vi.fn();
    row("a").addEventListener("contextmenu", menu);

    land(row("a").querySelector("span")!, 20, 10);
    vi.advanceTimersByTime(TOUCH_MENU_MS);

    expect(row("a").hasAttribute("data-lifted")).toBe(false);
    expect(menu).not.toHaveBeenCalled();
  });

  it("without touchHold a mouse-and-pen list is unchanged", () => {
    const { row } = mount();
    const seen = vi.fn();
    row("a").addEventListener("touchstart", seen);
    land(row("a").querySelector("span")!, 20, 10);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
