// Reactive effects run only with Solid's browser build (the DOM config)
import { createRoot } from "solid-js";
import { createMutable } from "solid-js/store";
import { describe, expect, it, vi } from "vitest";

import { watchAudioSettings } from "./audioQuality";

describe("watchAudioSettings", () => {
  function setup() {
    const settings = createMutable({
      echoCancellation: true,
      autoGainControl: true,
      noiseSupression: "browser" as "browser" | "enhanced" | "disabled",
      highQualityAudio: false,
    });
    const restart = vi.fn();
    const republish = vi.fn();
    const dispose = createRoot((dispose) => {
      watchAudioSettings(settings, { restartCapture: restart, republish });
      return dispose;
    });
    restart.mockClear();
    return { settings, restart, republish, dispose };
  }

  it("switching high quality audio publishes once and does not restart the capture too", () => {
    const { settings, restart, republish, dispose } = setup();
    settings.highQualityAudio = true;
    expect(republish).toHaveBeenCalledOnce();
    expect(restart).not.toHaveBeenCalled();
    settings.highQualityAudio = false;
    expect(republish).toHaveBeenCalledTimes(2);
    expect(restart).not.toHaveBeenCalled();
    dispose();
  });

  it("a processing change restarts the capture once and publishes nothing", () => {
    const { settings, restart, republish, dispose } = setup();
    settings.echoCancellation = false;
    expect(restart).toHaveBeenCalledOnce();
    expect(restart.mock.calls[0][0]).toMatchObject({ echoCancellation: false });
    expect(republish).not.toHaveBeenCalled();
    dispose();
  });
});
