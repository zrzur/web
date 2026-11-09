import { describe, expect, it } from "vitest";

import {
  MUSIC_BITRATE,
  audioCaptureFor,
  audioPublishFor,
  callBitrate,
} from "./audioQuality";

const voice = {
  echoCancellation: true,
  autoGainControl: true,
  noiseSupression: "browser" as const,
  preferredAudioInputDevice: "mic-1",
};

describe("voice publishing", () => {
  it("is Opus mono with DTX and RED at the server's voice bitrate", () => {
    expect(audioPublishFor(64_000, false)).toEqual({
      audioPreset: { maxBitrate: 64_000, priority: "high" },
      dtx: true,
      red: true,
      forceStereo: false,
    });
  });

  it("captures with the person's processing choices", () => {
    expect(audioCaptureFor(voice, false)).toEqual({
      deviceId: "mic-1",
      echoCancellation: true,
      noiseSuppression: true,
      voiceIsolation: true,
      autoGainControl: true,
      channelCount: 1,
    });
    expect(
      audioCaptureFor({ ...voice, noiseSupression: "enhanced" }, false),
    ).toMatchObject({ noiseSuppression: false, voiceIsolation: false });
  });
});

describe("high quality audio (music)", () => {
  it("is 128 kbps stereo, keeps RED and turns DTX off so quiet notes are not dropped", () => {
    expect(audioPublishFor(64_000, true)).toEqual({
      audioPreset: { maxBitrate: MUSIC_BITRATE, priority: "high" },
      dtx: false,
      red: true,
      forceStereo: true,
    });
  });

  it("never lowers a server level that already gives more", () => {
    expect(audioPublishFor(256_000, true).audioPreset?.maxBitrate).toBe(
      256_000,
    );
    expect(callBitrate(256_000, true)).toBe(256_000);
    expect(callBitrate(64_000, true)).toBe(128_000);
    expect(callBitrate(64_000, false)).toBe(64_000);
  });

  it("captures stereo with every voice treatment off", () => {
    expect(audioCaptureFor(voice, true)).toEqual({
      deviceId: "mic-1",
      echoCancellation: false,
      noiseSuppression: false,
      voiceIsolation: false,
      autoGainControl: false,
      channelCount: 2,
    });
  });
});
