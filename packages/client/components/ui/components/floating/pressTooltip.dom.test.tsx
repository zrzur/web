import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { floating, floatingElements } from "../../directives/floating";

vi.mock("@revolt/common", () => ({ useDevice: () => ({ isIOSTouch: false }) }));

function pointer(type: string, pointerType: string, detail = 1) {
  const event = new MouseEvent(type, { bubbles: true, detail });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}

/** In browser order: a lifted finger leaves the element before the click */
function press(element: HTMLElement, pointerType: string) {
  element.dispatchEvent(pointer("pointerdown", pointerType));
  if (pointerType !== "mouse") {
    element.dispatchEvent(pointer("pointerleave", pointerType));
  }
  element.dispatchEvent(pointer("click", pointerType));
}

let dispose: () => void;
let button: HTMLButtonElement;

function setup(options: { press?: boolean } = { press: true }) {
  button = document.createElement("button");
  document.body.append(button);
  createRoot((done) => {
    dispose = done;
    floating(button, () => ({
      tooltip: { content: "Bug Hunter", placement: "top", ...options },
    }));
  });
}

/** jsdom has no :focus-visible */
function keyboardOpen() {
  button.matches = (() => true) as never;
  button.dispatchEvent(new FocusEvent("focus"));
  expect(shown()?.tooltip).toBeTruthy();
}

const shown = () =>
  floatingElements()
    .find((entry) => entry.element === button)
    ?.show();

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

describe("tooltips opened by press", () => {
  it("open on a touch press and close on the next one", async () => {
    setup();
    await Promise.resolve();
    press(button, "touch");
    expect(shown()?.tooltip).toBeTruthy();
    press(button, "touch");
    expect(shown()).toBeUndefined();
  });

  it("close when the press lands somewhere else", async () => {
    setup();
    await Promise.resolve();
    press(button, "touch");
    document.body.dispatchEvent(pointer("pointerdown", "touch"));
    expect(shown()).toBeUndefined();
  });

  it("leave the mouse alone: hover opens it, a click does not close it", async () => {
    setup();
    await Promise.resolve();
    button.dispatchEvent(pointer("pointerenter", "mouse"));
    expect(shown()?.tooltip).toBeTruthy();
    press(button, "mouse");
    expect(shown()?.tooltip).toBeTruthy();
  });

  it("stay off for tooltips that did not ask for it", async () => {
    setup({});
    await Promise.resolve();
    press(button, "touch");
    expect(shown()).toBeUndefined();
  });

  it("still close from outside after a press was dragged off the badge", async () => {
    setup();
    await Promise.resolve();
    press(button, "touch");
    // the finger comes down on the badge, then the browser takes it to scroll
    button.dispatchEvent(pointer("pointerdown", "touch"));
    button.dispatchEvent(pointer("pointercancel", "touch"));
    expect(shown()?.tooltip).toBeTruthy();
    document.body.dispatchEvent(pointer("pointerdown", "touch"));
    expect(shown()).toBeUndefined();
  });

  it("do not let a cancelled press close a keyboard tooltip", async () => {
    setup();
    await Promise.resolve();
    keyboardOpen();
    button.dispatchEvent(pointer("pointerdown", "touch"));
    button.dispatchEvent(pointer("pointercancel", "touch"));
    // Enter on a focused button is a click with detail 0
    button.dispatchEvent(pointer("click", "", 0));
    expect(shown()?.tooltip).toBeTruthy();
  });

  it("do not let a finger lifted elsewhere close a keyboard tooltip", async () => {
    setup();
    await Promise.resolve();
    keyboardOpen();
    button.dispatchEvent(pointer("pointerdown", "touch"));
    button.dispatchEvent(pointer("click", "", 0));
    expect(shown()?.tooltip).toBeTruthy();
  });
});

describe("pens", () => {
  it("open a press tooltip by press, and close it with the next", async () => {
    setup();
    await Promise.resolve();
    press(button, "pen");
    expect(shown()?.tooltip).toBeTruthy();
    press(button, "pen");
    expect(shown()).toBeUndefined();
  });

  it("do not flash a press tooltip when the tip touches down", async () => {
    setup();
    await Promise.resolve();
    button.dispatchEvent(pointer("pointerenter", "pen"));
    expect(shown()).toBeUndefined();
    press(button, "pen");
    expect(shown()?.tooltip).toBeTruthy();
  });

  it("keep hover on ordinary tooltips", async () => {
    setup({});
    await Promise.resolve();
    button.dispatchEvent(pointer("pointerenter", "pen"));
    expect(shown()?.tooltip).toBeTruthy();
    button.dispatchEvent(pointer("pointerleave", "pen"));
    expect(shown()).toBeUndefined();
  });
});

describe("tooltips opened by keyboard", () => {
  it("close on blur", async () => {
    setup();
    await Promise.resolve();
    keyboardOpen();
    button.dispatchEvent(new FocusEvent("blur"));
    expect(shown()).toBeUndefined();
  });

  it("close on a tap on a device with both, press or not", async () => {
    setup({});
    await Promise.resolve();
    keyboardOpen();
    button.dispatchEvent(pointer("pointerleave", "touch"));
    expect(shown()).toBeUndefined();
  });

  it("close on a press elsewhere when the tooltip is pressable", async () => {
    setup();
    await Promise.resolve();
    keyboardOpen();
    document.body.dispatchEvent(pointer("pointerdown", "touch"));
    expect(shown()).toBeUndefined();
  });
});
