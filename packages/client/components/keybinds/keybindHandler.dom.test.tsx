import { For, Show, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindKeymap, defaultKeymap } from "./active";
import { KeybindAction } from "./keybindActions";
import {
  KeybindContext,
  candidateActions,
  createKeybind,
} from "./keybindHandler";
import { compileKeymap } from "./keymapCompile";

let dispose: (() => void) | undefined;

function Bind(props: { action: KeybindAction; spy: () => void }) {
  createKeybind(props.action, props.spy);
  return null;
}

function mount(binds: [KeybindAction, () => void][]) {
  dispose = render(
    () => (
      <KeybindContext>
        <For each={binds}>
          {([action, spy]) => <Bind action={action} spy={spy} />}
        </For>
      </KeybindContext>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const press = (init: KeyboardEventInit) =>
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );

beforeEach(() => {
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => {
  dispose?.();
  bindKeymap(defaultKeymap);
});

describe("KeybindContext", () => {
  it("runs the bound action for its keys, once per press", () => {
    const up = vi.fn();
    mount([[KeybindAction.NAVIGATION_CHANNEL_UP, up]]);
    press({ key: "ArrowUp", code: "ArrowUp", altKey: true });
    expect(up).toHaveBeenCalledTimes(1);
    // a held key repeats: nothing more
    press({ key: "ArrowUp", code: "ArrowUp", altKey: true, repeat: true });
    expect(up).toHaveBeenCalledTimes(1);
  });

  it("follows the person's own keys", () => {
    const up = vi.fn();
    bindKeymap((mac) =>
      compileKeymap(
        { navigation_channel_up: { code: "KeyU", mod: true, shift: true } },
        mac,
      ),
    );
    mount([[KeybindAction.NAVIGATION_CHANNEL_UP, up]]);
    press({ key: "ArrowUp", code: "ArrowUp", altKey: true });
    expect(up).not.toHaveBeenCalled();
    press({ key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });
    expect(up).toHaveBeenCalledTimes(1);
  });

  it("gives Escape to the most important open thing only", () => {
    const close = vi.fn();
    const jump = vi.fn();
    mount([
      [KeybindAction.CHAT_JUMP_END, jump],
      [KeybindAction.CLOSE_MODAL, close],
    ]);
    press({ key: "Escape", code: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(jump).not.toHaveBeenCalled();
  });

  it("stops calling a binding once its component is gone", () => {
    const up = vi.fn();
    const [shown, setShown] = createSignal(true);
    dispose = render(
      () => (
        <KeybindContext>
          <Show when={shown()}>
            <Bind action={KeybindAction.NAVIGATION_CHANNEL_UP} spy={up} />
          </Show>
        </KeybindContext>
      ),
      document.body.firstElementChild as HTMLElement,
    );
    setShown(false);
    press({ key: "ArrowUp", code: "ArrowUp", altKey: true });
    expect(up).not.toHaveBeenCalled();
  });

  it("starts typing into the message box on a letter, not with Ctrl", () => {
    const focus = vi.fn();
    mount([[KeybindAction.CHAT_FOCUS_COMPOSITION, focus]]);
    press({ key: "h", code: "KeyH" });
    expect(focus).toHaveBeenCalledTimes(1);
    press({ key: "h", code: "KeyH", ctrlKey: true });
    expect(focus).toHaveBeenCalledTimes(1);
    // paste still lands in the message box
    press({ key: "v", code: "KeyV", ctrlKey: true });
    expect(focus).toHaveBeenCalledTimes(2);
  });
});

describe("candidateActions", () => {
  it("is one lookup plus the fixed keys, in priority order", () => {
    expect(
      candidateActions({
        key: "Escape",
        code: "Escape",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }).slice(0, 2),
    ).toEqual([KeybindAction.CLOSE_FLOATING, KeybindAction.CLOSE_MODAL]);
    expect(
      candidateActions({
        key: "Escape",
        code: "Escape",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toContain(KeybindAction.CHAT_MARK_SERVER_AS_READ);
    expect(
      candidateActions({
        key: "q",
        code: "KeyQ",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toEqual([KeybindAction.CHAT_FOCUS_COMPOSITION]);
  });
});
