import { describe, expect, it } from "vitest";

import {
  followScreenShare,
  notificationPreviewAllowed,
  setStreamerMode,
} from "./streamer";

function fakeState(onShare = false) {
  const settings = { streamerMode: false, streamerOnShare: onShare };
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
