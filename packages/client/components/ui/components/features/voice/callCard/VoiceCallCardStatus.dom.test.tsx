import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui/components/design/Button", () => ({
  Button: (props: { children?: unknown; onPress?: () => void }) => (
    <button onClick={() => props.onPress?.()}>
      {props.children as string}
    </button>
  ),
}));
vi.mock("../SignalBars", () => ({ SignalBars: () => <span /> }));

const [state, setState] = createSignal("CONNECTED");
const [notice, setNotice] = createSignal<string>();
const [latched, setLatched] = createSignal(false);
const [canRejoin, setCanRejoin] = createSignal(true);
const rejoin = vi.fn();
vi.mock("@revolt/rtc", () => ({
  useVoice: () => ({
    state,
    notice,
    pttLatched: latched,
    canRejoin,
    error: () => undefined,
    channel: () => ({ id: "voice-1" }),
    rejoin,
  }),
}));

import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  setState("CONNECTED");
  setNotice(undefined);
  setLatched(false);
  setCanRejoin(true);
  rejoin.mockClear();
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <VoiceCallCardStatus />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
});
afterEach(() => dispose?.());

const status = () => document.querySelector('[role="status"]')!;

describe("call status", () => {
  it("says plainly that the connection was lost while reconnecting", () => {
    setState("RECONNECTING");
    expect(document.body.textContent).toContain(
      "Connection lost. Reconnecting…",
    );
    expect(document.querySelector("button")).toBeNull();
  });

  it("announces a finished reconnect and an unplugged microphone", () => {
    setNotice("reconnected");
    expect(status().textContent).toBe("Reconnected");
    setNotice("inputFallback");
    expect(status().textContent).toBe(
      "Microphone unplugged. Using the default microphone.",
    );
    setNotice(undefined);
    expect(status().textContent).toBe("");
  });

  it("shows when talking was turned on from another app", () => {
    expect(document.body.textContent).not.toContain("Talking (toggle on)");
    setLatched(true);
    expect(document.body.textContent).toContain("Talking (toggle on)");
  });

  it("offers no Rejoin when another tab or device took the seat", () => {
    setCanRejoin(false);
    setState("DISCONNECTED");
    expect(document.querySelector("button")).toBeNull();
  });

  it("offers Rejoin once reconnecting gave up", () => {
    setState("DISCONNECTED");
    const button = document.querySelector("button")!;
    expect(button.textContent).toBe("Rejoin");
    button.click();
    expect(rejoin).toHaveBeenCalledOnce();
  });
});
