import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Column: (props: { children?: unknown }) => (
    <div>{props.children as never}</div>
  ),
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    isDisabled?: boolean;
    "data-testid"?: string;
  }) => (
    <button
      type="button"
      disabled={props.isDisabled}
      data-testid={props["data-testid"]}
      onClick={() => props.onPress?.()}
    >
      {props.children as never}
    </button>
  ),
  IconButton: (props: {
    children?: unknown;
    onPress?: () => void;
    "aria-label"?: string;
  }) => (
    <button
      type="button"
      aria-label={props["aria-label"]}
      onClick={() => props.onPress?.()}
    >
      {props.children as never}
    </button>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("../Settings", () => ({
  useSettingsNavigation: () => ({ navigate: () => undefined }),
}));

import { Keybinds } from "@revolt/state/stores/Keybinds";

import { shortcutFor, unbindKeymap } from "../../../../keybinds/active";

function fakeState() {
  const [store, setStore] = createStore<Record<string, unknown>>({
    keybinds: { custom: {} },
  });
  const state = {
    get: (key: string) => store[key],
    set: (...args: unknown[]) =>
      (setStore as unknown as (...a: unknown[]) => void)(...args),
    voice: { inputMode: "voice", pttKey: "Backquote" },
    settings: { streamerMode: false },
  } as Record<string, unknown>;
  state.keybinds = new Keybinds(state as never);
  return state as unknown as { keybinds: Keybinds };
}

let state = fakeState();
vi.mock("@revolt/state", () => ({ useState: () => state }));

import { KeybindsSettings } from "./Keybinds";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <KeybindsSettings />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const caps = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-shortcut="${id}"]`)!;
const capsText = (id: string) =>
  [...caps(id).querySelectorAll("kbd")].map((k) => k.textContent).join("+");
const note = () =>
  document.querySelector('[data-testid="keybind-note"]')?.textContent ?? "";
const press = (code: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      code,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
const buttonNamed = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === name,
  )!;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  state = fakeState();
  state.keybinds.hydrate();
});
afterEach(() => {
  dispose?.();
  unbindKeymap();
});

describe("changing a shortcut on the Ctrl+/ screen", () => {
  it("shows every changeable shortcut with its current keys", () => {
    mount();
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+M");
    expect(capsText("toggle_streamer")).toBe("Ctrl+Shift+L");
    expect(capsText("navigation_server_up")).toBe("Ctrl+Alt+↑");
  });

  it("records a new combination and the app uses it at once", () => {
    mount();
    caps("toggle_mute").click();
    expect(note()).toContain("Press the new keys");
    // a modifier alone waits for the real key
    press("ShiftLeft", { shiftKey: true });
    expect(note()).toContain("Press the new keys");
    press("KeyF", { ctrlKey: true, shiftKey: true, key: "F" });
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+F");
    expect(
      shortcutFor(
        {
          code: "KeyF",
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        },
        false,
      ),
    ).toBe("toggle_mute");
    expect(
      shortcutFor(
        {
          code: "KeyM",
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        },
        false,
      ),
    ).toBe(undefined);
  });

  it("runs no other shortcut and no other listener while recording", () => {
    mount();
    const body = vi.fn();
    document.body.addEventListener("keydown", body);
    caps("toggle_mute").click();
    expect(
      shortcutFor(
        {
          code: "KeyD",
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        },
        false,
      ),
    ).toBe(undefined);
    press("Escape", { key: "Escape" });
    expect(body).not.toHaveBeenCalled();
    expect(note()).toBe("");
    document.body.removeEventListener("keydown", body);
  });

  it("offers to swap when another shortcut has the keys", () => {
    mount();
    caps("toggle_mute").click();
    press("KeyD", { ctrlKey: true, shiftKey: true, key: "D" });
    expect(note()).toContain("is already used for “Deafen or undeafen”");
    // nothing changed yet
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+M");
    buttonNamed("Swap").click();
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+D");
    expect(capsText("toggle_deafen")).toBe("Ctrl+Shift+M");
  });

  it("refuses keys the browser keeps, in plain words", () => {
    mount();
    caps("toggle_mute").click();
    press("KeyW", { ctrlKey: true, key: "w" });
    expect(note()).toContain("Your browser keeps Ctrl+W for itself");
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+M");
  });

  it("refuses a plain letter, which is needed for typing", () => {
    mount();
    caps("toggle_mute").click();
    press("KeyK", { key: "k" });
    expect(note()).toContain("is needed for typing");
  });

  it("asks before replacing a browser shortcut", () => {
    mount();
    caps("toggle_streamer").click();
    press("KeyF", { ctrlKey: true, key: "f" });
    expect(note()).toContain("replaces a browser shortcut");
    buttonNamed("Use anyway").click();
    expect(capsText("toggle_streamer")).toBe("Ctrl+F");
  });

  it("resets one shortcut, then all of them", () => {
    mount();
    const resetAll = document.querySelector<HTMLButtonElement>(
      '[data-testid="keybinds-reset-all"]',
    )!;
    expect(resetAll.disabled).toBe(true);
    caps("toggle_mute").click();
    press("KeyF", { ctrlKey: true, shiftKey: true, key: "F" });
    caps("create_poll").click();
    press("Digit1", { ctrlKey: true, shiftKey: true, key: "!" });
    expect(resetAll.disabled).toBe(false);

    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Reset Mute or unmute to the default"]',
      )!
      .click();
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+M");
    expect(capsText("create_poll")).toBe("Ctrl+Shift+1");

    resetAll.click();
    expect(capsText("create_poll")).toBe("Ctrl+Shift+8");
  });
});
