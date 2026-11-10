import { describe, expect, it } from "vitest";

import { followScreenShare, shareWithStreamerMode } from "../rtc/streamerShare";
import type { Settings } from "./stores/Settings";

function fakeState(onShare = false) {
  const values: Record<string, unknown> = {
    "privacy:streamer_on_share": onShare,
  };
  const settings = {
    getValue: (key: string) => values[key],
    setValue: (key: string, value: unknown) => void (values[key] = value),
    get streamerMode() {
      return !!values["privacy:streamer_mode"];
    },
    set streamerMode(on: boolean) {
      values["privacy:streamer_by_share"] = false;
      values["privacy:streamer_mode"] = on;
    },
    get streamerByShare() {
      return !!values["privacy:streamer_by_share"];
    },
  };
  return { settings } as unknown as { settings: Settings } & {
    settings: typeof settings;
  };
}

describe("streamer mode and screen sharing", () => {
  it("stays off when sharing starts and the option is off (the default)", () => {
    const state = fakeState(false);
    followScreenShare(state, true);
    expect(state.settings.streamerMode).toBe(false);
  });

  it("turns on with a share and off again when it ends", () => {
    const state = fakeState(true);
    followScreenShare(state, true);
    expect(state.settings.streamerMode).toBe(true);
    followScreenShare(state, false);
    expect(state.settings.streamerMode).toBe(false);
  });

  it("leaves a mode the person turned on alone when the share ends", () => {
    const state = fakeState(true);
    state.settings.streamerMode = true;
    followScreenShare(state, true);
    followScreenShare(state, false);
    expect(state.settings.streamerMode).toBe(true);
  });

  it("keeps a choice made during the share", () => {
    const state = fakeState(true);
    followScreenShare(state, true);
    // turned off and on again by hand while sharing
    state.settings.streamerMode = false;
    state.settings.streamerMode = true;
    followScreenShare(state, false);
    expect(state.settings.streamerMode).toBe(true);
  });
});

describe("streamer mode around the capture (review S3)", () => {
  it("is on before the capture starts", async () => {
    const state = fakeState(true);
    let onWhenCapturing = false;
    let sharing = false;
    await shareWithStreamerMode(
      state,
      false,
      async () => {
        onWhenCapturing = state.settings.streamerMode;
        sharing = true;
      },
      () => sharing,
    );
    expect(onWhenCapturing).toBe(true);
    expect(state.settings.streamerMode).toBe(true);
  });

  it("goes off again when the capture fails or is cancelled", async () => {
    const state = fakeState(true);
    await expect(
      shareWithStreamerMode(
        state,
        false,
        async () => {
          throw new DOMException("cancelled", "NotAllowedError");
        },
        () => false,
      ),
    ).rejects.toThrow();
    expect(state.settings.streamerMode).toBe(false);
    expect(state.settings.streamerByShare).toBe(false);
  });

  it("a mode a share turned on is off after a reload", () => {
    const state = fakeState(true);
    followScreenShare(state, true);
    expect(state.settings.streamerByShare).toBe(true);
    followScreenShare(state.settings as never, false);
    expect(state.settings.streamerMode).toBe(false);
    expect(state.settings.streamerByShare).toBe(false);
  });

  it("a mode the person turned on stays on after a reload", () => {
    const state = fakeState(true);
    state.settings.streamerMode = true;
    followScreenShare(state.settings as never, false);
    expect(state.settings.streamerMode).toBe(true);
  });
});
