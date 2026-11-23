// Bug #9 (owner, 2026-11-22): dragging the floating call card opened the
// call. A press is a tap until it travels past the threshold; a drag never
// ends as a click, and the card's buttons never start one.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DRAG_THRESHOLD,
  createDragGesture,
  isDragHandle,
} from "./floatingDrag";

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}) {
  // jsdom has no PointerEvent: a MouseEvent with the pointer fields
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: init.button ?? 0,
  });
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    isPrimary: init.isPrimary ?? true,
  });
  return event as PointerEvent;
}

function card() {
  document.body.innerHTML = `
    <div id="float">
      <div data-voice-pip>
        <button data-pip-back type="button"><span id="face"></span></button>
        <button id="mute" type="button"></button>
      </div>
    </div>`;
  const float = document.getElementById("float")!;
  float.getBoundingClientRect = () =>
    ({ x: 100, y: 100, width: 300, height: 170 }) as DOMRect;
  const back = document.querySelector<HTMLButtonElement>("[data-pip-back]")!;
  const opened = vi.fn();
  back.addEventListener("click", opened);
  const events = { start: vi.fn(), move: vi.fn(), drop: vi.fn() };
  const gesture = createDragGesture({
    element: () => float,
    onStart: events.start,
    onMove: events.move,
    onDrop: events.drop,
  });
  float.addEventListener("pointerdown", (e) => gesture.pointerDown(e as PointerEvent));
  return { float, back, opened, events, gesture };
}

/** what a browser does: down on the target, moves, up, then a click on it */
function press(target: Element, path: [number, number][]) {
  const [first, ...rest] = path;
  target.dispatchEvent(pointer("pointerdown", ...first));
  for (const point of rest) document.dispatchEvent(pointer("pointermove", ...point));
  const last = path[path.length - 1];
  document.dispatchEvent(pointer("pointerup", ...last));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("the floating call card", () => {
  it("a drag moves it and never opens the call", () => {
    const { back, opened, events } = card();
    press(back, [
      [150, 150],
      [170, 160],
      [400, 500],
    ]);
    expect(events.start).toHaveBeenCalledTimes(1);
    expect(events.move).toHaveBeenLastCalledWith({ x: 350, y: 450 });
    expect(events.drop).toHaveBeenCalledWith({ x: 350, y: 450 });
    expect(opened).not.toHaveBeenCalled();
  });

  it("a clean tap opens the call and moves nothing", () => {
    const { back, opened, events } = card();
    press(back, [[150, 150]]);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(events.start).not.toHaveBeenCalled();
    expect(events.drop).not.toHaveBeenCalled();
  });

  it("a shaky tap inside the threshold is still a tap", () => {
    const { back, opened, events } = card();
    press(back, [
      [150, 150],
      [150 + DRAG_THRESHOLD - 1, 151],
    ]);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(events.start).not.toHaveBeenCalled();
  });

  it("a press on a picture inside the card can drag it too", () => {
    const { opened, events } = card();
    press(document.getElementById("face")!, [
      [150, 150],
      [300, 300],
    ]);
    expect(events.drop).toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
  });

  it("the mute button never starts a drag and still works", () => {
    const { events } = card();
    const mute = document.getElementById("mute")!;
    const clicked = vi.fn();
    mute.addEventListener("click", clicked);
    press(mute, [
      [380, 150],
      [380, 400],
    ]);
    expect(events.start).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("only the swallowed click after a drag is lost, the next tap opens", () => {
    vi.useFakeTimers();
    const { back, opened } = card();
    press(back, [
      [150, 150],
      [300, 300],
    ]);
    vi.advanceTimersByTime(1000);
    press(back, [[150, 150]]);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("a cancelled touch drops the card where it was", () => {
    const { back, events } = card();
    back.dispatchEvent(pointer("pointerdown", 150, 150));
    document.dispatchEvent(pointer("pointermove", 200, 260));
    document.dispatchEvent(pointer("pointercancel", 200, 260));
    expect(events.drop).toHaveBeenCalledWith({ x: 150, y: 210 });
  });

  it("a second finger or another button does nothing", () => {
    const { back, events } = card();
    back.dispatchEvent(pointer("pointerdown", 150, 150, { isPrimary: false }));
    back.dispatchEvent(pointer("pointerdown", 150, 150, { button: 2 }));
    document.dispatchEvent(pointer("pointermove", 400, 400));
    expect(events.start).not.toHaveBeenCalled();
  });
});

describe("where a drag may start", () => {
  it("anywhere on the card but its buttons", () => {
    card();
    expect(isDragHandle(document.getElementById("face"))).toBe(true);
    expect(isDragHandle(document.querySelector("[data-pip-back]"))).toBe(true);
    expect(isDragHandle(document.getElementById("mute"))).toBe(false);
    expect(isDragHandle(document.body)).toBe(false);
  });
});
