import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { createMutable } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Toggle: (await import("@revolt/ui/components/design/Toggle")).Toggle,
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    isDisabled?: boolean;
    "data-testid"?: string;
  }) => (
    <button
      data-testid={props["data-testid"]}
      disabled={props.isDisabled}
      onClick={() => props.onPress?.()}
    >
      {props.children as string}
    </button>
  ),
  FloatingSelect: () => <div />,
  MenuItem: () => null,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

const [status, setStatus] = createSignal<unknown>();
const [heard, setHeard] = createSignal<unknown>();
const call = {
  gameKeys: status,
  gameKeyHeard: heard,
  setGameKeys: setStatus,
  setGameKeyTest: vi.fn(),
};
vi.mock("@revolt/rtc", () => ({ useVoice: () => call }));

const voice = createMutable({
  inputMode: "ptt",
  pttKey: "Backquote",
  gameKeys: true,
  gameBinds: {} as Record<string, string>,
  pttReleaseDelay: 200,
  setGameBind(action: string, bind: string | undefined) {
    const next = { ...voice.gameBinds };
    if (bind) next[action] = bind;
    else delete next[action];
    voice.gameBinds = next;
  },
});
vi.mock("@revolt/state", () => ({ useState: () => ({ voice }) }));

import { GameKeysOptions } from "./GameKeysOptions";

let dispose: (() => void) | undefined;
const win = window as unknown as { native?: unknown };

function mount(desktop: boolean) {
  win.native = desktop
    ? {
        globalKeys: {
          status: async () => status(),
          set: async () => status(),
          clear() {},
          askPermission: async () => status(),
          onEvent: () => () => undefined,
          onStatus: () => () => undefined,
        },
      }
    : undefined;
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <GameKeysOptions />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const text = () => document.body.textContent ?? "";
const key = (type: string, code: string, init: KeyboardEventInit = {}) =>
  window.dispatchEvent(
    new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init }),
  );
const change = (action: string) =>
  (
    document.querySelector(
      `[data-testid="game-key-${action}"] button`,
    ) as HTMLButtonElement
  ).click();

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  voice.gameBinds = {};
  voice.gameKeys = true;
  setStatus({ state: "ready", platform: "win32", wayland: false });
  setHeard(undefined);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  win.native = undefined;
});

describe("keys that work in games (voice settings)", () => {
  it("in a browser: says the keys need the tab, points to the desktop app, offers no binds", () => {
    mount(false);
    expect(text()).toContain("only while the Zrzur tab is active");
    expect(text()).toContain("Get the desktop app");
    expect(document.querySelector('[data-testid^="game-key-"]')).toBeNull();
    expect(
      document.querySelector('[data-testid="game-keys-test-button"]'),
    ).toBeNull();
    // the release delay belongs to push to talk everywhere
    expect(text()).toContain("Release delay");
  });

  it("in the desktop app: the four actions, the state and the privacy line", () => {
    mount(true);
    for (const action of ["talk", "mute", "toggleMute", "toggleDeafen"])
      expect(
        document.querySelector(`[data-testid="game-key-${action}"]`),
        action,
      ).not.toBeNull();
    expect(text()).toContain(
      "Ready. Zrzur listens only while you are in a call.",
    );
    expect(text()).toContain("It records nothing and sends nothing.");
    expect(text()).toContain("started as administrator");
    // push to talk shows the push-to-talk key until a game bind is chosen
    expect(
      document.querySelector('[data-testid="game-key-talk"] kbd')?.textContent,
    ).toBe("`");
  });

  it("shows why the listener is not running, with the technical part under Details", () => {
    setStatus({
      state: "error",
      platform: "linux",
      wayland: true,
      detail: "libX11.so.6: cannot open shared object file",
    });
    mount(true);
    expect(text()).toContain("could not start listening for keys");
    expect(document.querySelector("details code")?.textContent).toContain(
      "libX11",
    );
    expect(text()).toContain("XWayland");
    expect(
      (
        document.querySelector(
          '[data-testid="game-keys-test-button"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("records a combination, a modifier alone and a mouse side button", () => {
    mount(true);
    change("toggleMute");
    key("keydown", "ControlLeft", { ctrlKey: true });
    key("keydown", "F9", { ctrlKey: true });
    expect(voice.gameBinds.toggleMute).toBe("Ctrl+F9");

    change("talk");
    key("keydown", "ControlRight", { ctrlKey: true });
    key("keyup", "ControlRight");
    expect(voice.gameBinds.talk).toBe("ControlRight");

    change("mute");
    window.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 3,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(voice.gameBinds.mute).toBe("Mouse4");
    // letting the side button go must not go back in the page
    for (const type of ["mouseup", "auxclick"]) {
      const release = new MouseEvent(type, {
        button: 3,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(release);
      expect(release.defaultPrevented, type).toBe(true);
    }
    // a later, unrelated press of that button is left alone
    const later = new MouseEvent("mouseup", {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("refuses a typing key as a switch and a key another action has, in plain words", () => {
    mount(true);
    change("toggleMute");
    key("keydown", "KeyM");
    expect(voice.gameBinds.toggleMute).toBeUndefined();
    expect(text()).toContain("A key that types would switch this");
    key("keydown", "Escape");
    expect(text()).not.toContain("A key that types would switch this");

    voice.gameBinds = { talk: "Mouse4" };
    change("mute");
    window.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 3,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(voice.gameBinds.mute).toBeUndefined();
    expect(text()).toContain("Push to talk already uses that");
  });

  it("the test shows a key heard while another window was in front", () => {
    mount(true);
    (
      document.querySelector(
        '[data-testid="game-keys-test-button"]',
      ) as HTMLButtonElement
    ).click();
    expect(call.setGameKeyTest).toHaveBeenCalledWith(true);
    expect(text()).toContain("Not heard yet");
    setHeard({ action: "talk", down: true, away: false });
    expect(text()).toContain("Heard in the Zrzur window only");
    setHeard({ action: "talk", down: true, away: true });
    expect(text()).toContain("Heard in another window");
  });
});
