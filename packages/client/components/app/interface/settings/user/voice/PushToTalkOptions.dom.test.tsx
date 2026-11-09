import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createMutable } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Toggle: (await import("@revolt/ui/components/design/Toggle")).Toggle,
  Button: (props: { children?: unknown }) => (
    <button>{props.children as string}</button>
  ),
  FloatingSelect: () => <div />,
  MenuItem: () => null,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/rtc", () => ({
  useVoice: () => ({ globalPtt: () => "off" }),
}));

const voice = createMutable({
  inputMode: "ptt",
  pttKey: "Backquote",
  globalTalk: false,
});
vi.mock("@revolt/state", () => ({ useState: () => ({ voice }) }));

import { PushToTalkOptions } from "./PushToTalkOptions";

let dispose: (() => void) | undefined;
const win = window as unknown as { native?: unknown };

function mount(desktop: boolean) {
  win.native = desktop
    ? {
        pushToTalk: {
          register: async () => true,
          unregister() {},
          onToggle: () => () => undefined,
        },
      }
    : undefined;
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <PushToTalkOptions />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  voice.pttKey = "Backquote";
  voice.globalTalk = false;
});
afterEach(() => {
  dispose?.();
  delete win.native;
});

const talkSwitch = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
    (el) =>
      document.getElementById(el.getAttribute("aria-labelledby")!)
        ?.textContent === "Talk from other apps",
  );

describe("Talk from other apps", () => {
  it("is not offered in a browser", () => {
    mount(false);
    expect(talkSwitch()).toBeUndefined();
  });

  it("is off by default in the desktop app and turns on with its switch", () => {
    mount(true);
    const toggle = talkSwitch()!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(document.body.textContent).toContain(
      "Ctrl+Shift+` turns talking on and off while Zrzur is in the background.",
    );
    toggle.click();
    expect(voice.globalTalk).toBe(true);
  });

  it("cannot be turned on for a key other apps use with Ctrl+Shift", () => {
    voice.pttKey = "KeyV";
    mount(true);
    const toggle = talkSwitch()!;
    expect(toggle.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Other apps use Ctrl+Shift+V for editing. Choose another key to use this.",
    );
  });
});
