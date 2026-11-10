import { describe, expect, it } from "vitest";

import {
  followScreenShare,
  notificationPreviewAllowed,
  setStreamerMode,
  shareWithStreamerMode,
  streamerAfterLoad,
} from "./streamer";

function fakeState(onShare = false) {
  const settings = {
    streamerMode: false,
    streamerOnShare: onShare,
    streamerByShare: false,
  };
  return { settings } as unknown as Parameters<typeof setStreamerMode>[0] & {
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
    setStreamerMode(state, true);
    followScreenShare(state, true);
    followScreenShare(state, false);
    expect(state.settings.streamerMode).toBe(true);
  });

  it("keeps a choice made during the share", () => {
    const state = fakeState(true);
    followScreenShare(state, true);
    // turned off and on again by hand while sharing
    setStreamerMode(state, false);
    setStreamerMode(state, true);
    followScreenShare(state, false);
    expect(state.settings.streamerMode).toBe(true);
  });
});

describe("notification previews", () => {
  it("hides DM and group previews in streamer mode only", () => {
    expect(notificationPreviewAllowed(true, "DirectMessage")).toBe(false);
    expect(notificationPreviewAllowed(true, "Group")).toBe(false);
    expect(notificationPreviewAllowed(true, "TextChannel")).toBe(true);
    expect(notificationPreviewAllowed(false, "DirectMessage")).toBe(true);
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
    streamerAfterLoad(state.settings);
    expect(state.settings.streamerMode).toBe(false);
    expect(state.settings.streamerByShare).toBe(false);
  });

  it("a mode the person turned on stays on after a reload", () => {
    const state = fakeState(true);
    setStreamerMode(state, true);
    streamerAfterLoad(state.settings);
    expect(state.settings.streamerMode).toBe(true);
  });
});
