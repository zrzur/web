import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createMutable } from "solid-js/store";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the real design-system pieces this panel uses; the barrel pulls in
// @solid-aria, which Node cannot load here
vi.mock("@revolt/ui", async () => ({
  ...(await import("@revolt/ui/components/design/Settings")),
  Slider: (await import("@revolt/ui/components/design/Slider")).Slider,
  Toggle: (await import("@revolt/ui/components/design/Toggle")).Toggle,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

const voice = createMutable({
  inputSensitivityAuto: true,
  inputThreshold: -50,
  inputVolume: 1,
  preferredAudioInputDevice: undefined as string | undefined,
  echoCancellation: true,
  autoGainControl: true,
  noiseSupression: "browser",
  highQualityAudio: false,
});
vi.mock("@revolt/state", () => ({ useState: () => ({ voice }) }));

import { setCallInputLevel } from "@revolt/rtc/inputLevel";

import { InputSensitivityOptions } from "./InputSensitivityOptions";

let dispose: (() => void) | undefined;
const getUserMedia = vi.fn(() => new Promise<MediaStream>(() => undefined));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  voice.inputSensitivityAuto = true;
  voice.inputThreshold = -50;
  voice.highQualityAudio = false;
  setCallInputLevel(undefined);
  getUserMedia.mockClear();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  (window as unknown as { AudioContext: unknown }).AudioContext = class {};
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <InputSensitivityOptions />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
}

const slider = () =>
  document.querySelector<HTMLInputElement>(
    'input[type="range"][aria-label="Input sensitivity threshold"]',
  );
const automatic = () =>
  document.querySelector<HTMLButtonElement>('button[role="switch"]')!;
const testId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

describe("Input sensitivity settings", () => {
  it("starts on Automatic with no slider and no microphone test", () => {
    mount();
    expect(automatic().getAttribute("aria-checked")).toBe("true");
    expect(slider()).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("turning Automatic off shows the threshold slider and starts the meter", () => {
    mount();
    automatic().click();
    expect(voice.inputSensitivityAuto).toBe(false);
    const range = slider()!;
    expect(range).not.toBeNull();
    expect(range.min).toBe("-80");
    expect(range.max).toBe("0");
    expect(range.value).toBe("-50");
    expect(document.body.textContent).toContain("-50 dB");
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("tests the microphone with the same capture a call uses", () => {
    voice.inputSensitivityAuto = false;
    mount();
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: {
        deviceId: undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    // music mode: no voice treatment, stereo
    voice.highQualityAudio = true;
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: {
        deviceId: undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
      },
    });
  });

  it("moving the slider saves the threshold and moves the mark on the meter", () => {
    voice.inputSensitivityAuto = false;
    mount();
    const range = slider()!;
    range.value = "-20";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(voice.inputThreshold).toBe(-20);
    expect(document.body.textContent).toContain("-20 dB");
    // -20 dB is three quarters along the -80…0 scale
    expect(
      testId("sensitivity-mark").style.getPropertyValue("--z-meter-pos"),
    ).toBe("0.75");
  });

  it("in a call the meter shows the call's own level and gate, without a second microphone", () => {
    voice.inputSensitivityAuto = false;
    setCallInputLevel({ level: -40, open: true });
    mount();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(
      testId("sensitivity-level").style.getPropertyValue("--z-meter-pct"),
    ).toBe("50%");
    expect(testId("sensitivity-level").dataset.open).toBe("true");
    expect(testId("sensitivity-status").textContent).toContain(
      "Others hear you",
    );

    setCallInputLevel({ level: -70, open: false });
    expect(testId("sensitivity-level").dataset.open).toBe("false");
    expect(testId("sensitivity-status").textContent).toContain(
      "Silence is sent",
    );
  });

  it("says how to see the level when the microphone is refused", async () => {
    getUserMedia.mockImplementationOnce(() =>
      Promise.reject(new Error("NotAllowedError")),
    );
    voice.inputSensitivityAuto = false;
    mount();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.textContent).toContain(
      "Allow microphone access to see your level.",
    );
  });
});
