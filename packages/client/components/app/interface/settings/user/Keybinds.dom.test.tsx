import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Segmented: (await import("@revolt/ui/components/design/Segmented")).Segmented,
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
// saving and reminders are on: their two shortcuts are listed
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    configuration: { features: { saved_reminders: true } },
  }),
}));
vi.mock("../Settings", () => ({
  useSettingsNavigation: () => ({ navigate: () => undefined }),
}));

import { Keybinds } from "@revolt/state/stores/Keybinds";

import {
  bindKeymap,
  defaultKeymap,
  shortcutFor,
} from "../../../../keybinds/active";

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

// the Windows set, on any machine that runs the tests (jsdom reports the
// host system in its user agent)
Object.defineProperty(navigator, "platform", {
  value: "Win32",
  configurable: true,
});
Object.defineProperty(navigator, "userAgent", {
  value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) jsdom",
  configurable: true,
});

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
  bindKeymap(defaultKeymap);
});

describe("the keys of each system", () => {
  const view = (name: string) =>
    [...document.querySelectorAll<HTMLElement>("[role=radio]")]
      .find((radio) => radio.textContent?.trim() === name)!
      .click();
  const shown = (id: string) =>
    [...document.querySelectorAll(`[data-shortcut="${id}"][data-platform] kbd`)]
      .map((k) => k.textContent)
      .join("+");

  it("shows this device's set first, then the Mac and Linux sets to read", () => {
    mount();
    expect(capsText("navigation_unread_down")).toBe("Alt+Shift+↓");
    expect(capsText("upload_file")).toBe("Ctrl+Shift+U");
    view("macOS");
    expect(shown("navigation_server_up")).toBe("⌘+⌥+↑");
    expect(shown("upload_file")).toBe("⌘+⇧+U");
    expect(shown("navigation_channel_down")).toBe("⌥+↓");
    // another system's keys can't be recorded from here
    expect(document.querySelector('button[data-shortcut="upload_file"]')).toBe(
      null,
    );
    view("Linux");
    expect(shown("navigation_server_up")).toBe("Alt+Page Up");
    expect(shown("upload_file")).toBe("Ctrl+Alt+U");
    view("Windows");
    expect(capsText("navigation_server_up")).toBe("Ctrl+Alt+↑");
  });

  it("lists the message keys and the mention click", () => {
    mount();
    const text = document.body.textContent ?? "";
    for (const title of [
      "Mention someone",
      "Mention a role or a channel",
      "Reply",
      "Pin or unpin",
      "Copy the text",
      "Move between messages",
      "Next unread channel",
      "Open your mentions",
      "Leave the call",
    ])
      expect(text, title).toContain(title);
  });
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
    // (Ctrl+Shift+F opens the mentions now: Ctrl+Shift+2 is free)
    press("Digit2", { ctrlKey: true, shiftKey: true, key: "@" });
    expect(capsText("toggle_mute")).toBe("Ctrl+Shift+2");
    expect(
      shortcutFor(
        {
          code: "Digit2",
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
    // Ctrl+F is "Search this channel" now: Ctrl+G is find-next
    press("KeyG", { ctrlKey: true, key: "g" });
    expect(note()).toContain("replaces a browser shortcut");
    buttonNamed("Use anyway").click();
    expect(capsText("toggle_streamer")).toBe("Ctrl+G");
  });

  it("resets one shortcut, then all of them", () => {
    mount();
    const resetAll = document.querySelector<HTMLButtonElement>(
      '[data-testid="keybinds-reset-all"]',
    )!;
    expect(resetAll.disabled).toBe(true);
    caps("toggle_mute").click();
    press("Digit2", { ctrlKey: true, shiftKey: true, key: "@" });
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

  it("German Ctrl+Shift+7 types /: it clashes with Ctrl+/ and can swap (review B1)", () => {
    mount();
    caps("create_poll").click();
    press("Digit7", { ctrlKey: true, shiftKey: true, key: "/" });
    expect(note()).toContain("is already used for “Show keyboard shortcuts”");
    buttonNamed("Swap").click();
    expect(capsText("create_poll")).toBe("Ctrl+Shift+7");
    expect(capsText("open_shortcuts")).toBe("Ctrl+Shift+8");
    // the press now runs the person's own shortcut
    expect(
      shortcutFor(
        {
          code: "Digit7",
          key: "/",
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        },
        false,
      ),
    ).toBe("create_poll");
  });

  it("gives the focus back to the key caps after Swap and Cancel (review S7)", async () => {
    mount();
    caps("toggle_mute").click();
    press("KeyD", { ctrlKey: true, shiftKey: true, key: "D" });
    buttonNamed("Cancel").click();
    await Promise.resolve();
    expect(document.activeElement).toBe(caps("toggle_mute"));
    caps("toggle_mute").click();
    press("KeyD", { ctrlKey: true, shiftKey: true, key: "D" });
    buttonNamed("Swap").click();
    await Promise.resolve();
    expect(document.activeElement).toBe(caps("toggle_mute"));
  });

  it("flags synced shortcuts that share keys on this device (review S2)", () => {
    state.keybinds.setFromSync({
      custom: {
        toggle_mute: { code: "KeyJ", ctrl: true, shift: true },
        toggle_deafen: { code: "KeyJ", mod: true, shift: true },
      },
    });
    mount();
    const flags = [
      ...document.querySelectorAll('[data-testid="keybind-conflict"]'),
    ].map((el) => el.textContent);
    expect(flags).toHaveLength(2);
    expect(flags[0]).toContain("Deafen or undeafen");
  });

  it("refuses the push-to-talk key alone as a shortcut (review S6)", () => {
    (state as unknown as { voice: { pttKey: string } }).voice.pttKey = "F8";
    mount();
    caps("toggle_mute").click();
    press("F8", { key: "F8" });
    expect(note()).toContain("push-to-talk");
  });
});
