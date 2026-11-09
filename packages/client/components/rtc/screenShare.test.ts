import type { Room } from "livekit-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyQuality,
  captureOptions,
  clampDisplayMediaOptions,
  publishOptions,
  publishSafeQuality,
  republishCodec,
  resolveQuality,
  screenShareQualities,
  senderLiveStats,
  setDisplayMediaCap,
  watchRetiredCodecs,
} from "./screenShare";

const free = { resolution: [1280, 720] as [number, number], framerate: 30 };
const plus = { resolution: [1920, 1080] as [number, number], framerate: 60 };

describe("screenShareQualities", () => {
  it("offers 720p 30 FPS only within a 720p plan", () => {
    const q = screenShareQualities(free);
    expect(Object.keys(q)).toEqual(["720p30"]);
    expect(q["720p30"]).toMatchObject({
      width: 1280,
      height: 720,
      frameRate: 30,
    });
  });

  it("offers 60 FPS only where Feather or the server level allow it", () => {
    const q30 = screenShareQualities({
      resolution: [1920, 1080],
      framerate: 30,
    });
    expect(Object.keys(q30)).toEqual(["720p30", "1080p30"]);
    expect(Object.keys(screenShareQualities(plus))).toEqual([
      "720p30",
      "1080p30",
      "1080p60",
    ]);
    // 60 FPS allowed but not 1080p: nothing above 720p 30 FPS
    expect(
      Object.keys(screenShareQualities({ ...free, framerate: 60 })),
    ).toEqual(["720p30"]);
  });

  it("keeps the existing bitrate caps", () => {
    const q = screenShareQualities(plus);
    expect(q["720p30"]!.encoding).toEqual({
      maxBitrate: 2_000_000,
      maxFramerate: 30,
    });
    expect(q["1080p30"]!.encoding.maxBitrate).toBe(5_000_000);
    expect(q["1080p60"]!.encoding).toEqual({
      maxBitrate: 8_000_000,
      maxFramerate: 60,
    });
  });

  it("text and slides stay sharp, video and games stay smooth", () => {
    const sharp = screenShareQualities(plus, "detail")["1080p60"]!;
    expect(sharp.contentHint).toBe("detail");
    expect(sharp.degradationPreference).toBe("maintain-resolution");
    const smooth = screenShareQualities(plus, "motion")["1080p60"]!;
    expect(smooth.contentHint).toBe("motion");
    expect(smooth.degradationPreference).toBe("balanced");
    // sharp is the default
    expect(screenShareQualities(plus)["720p30"]!.contentHint).toBe("detail");
  });

  it("gives weak viewers smaller layers below every quality", () => {
    const q = screenShareQualities(plus);
    expect(q["720p30"]!.layers.map((l) => l.height)).toEqual([360]);
    expect(q["1080p60"]!.layers.map((l) => l.height)).toEqual([360, 720]);
    for (const quality of Object.values(q))
      for (const layer of quality.layers) {
        expect(layer.width).toBeLessThan(quality.width);
        expect(layer.encoding.maxBitrate).toBeLessThan(
          quality.encoding.maxBitrate,
        );
      }
  });

  it("never offers more than the plan allows", () => {
    const q = screenShareQualities(plus);
    for (const quality of Object.values(q)) {
      expect(quality.width).toBeLessThanOrEqual(1920);
      expect(quality.height).toBeLessThanOrEqual(1080);
      expect(quality.frameRate).toBeLessThanOrEqual(60);
    }
  });
});

describe("resolveQuality", () => {
  it("falls back to the best quality the plan still allows", () => {
    const q = screenShareQualities(free);
    expect(resolveQuality(q, "1080p60").name).toBe("720p30");
    const q30 = screenShareQualities({
      resolution: [1920, 1080],
      framerate: 30,
    });
    expect(resolveQuality(q30, "1080p60").name).toBe("1080p30");
    expect(resolveQuality(screenShareQualities(plus), undefined).name).toBe(
      "1080p30",
    );
    expect(resolveQuality(screenShareQualities(plus), "1080p60").name).toBe(
      "1080p60",
    );
  });
});

describe("capture and publish options", () => {
  it("capture at the chosen quality, not a 640×480 start-up size", () => {
    const high = screenShareQualities(plus)["1080p30"]!;
    expect(captureOptions(high, false)).toEqual({
      resolution: { width: 1920, height: 1080, frameRate: 30 },
      contentHint: "detail",
      audio: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
    });
    expect(publishOptions(high)).toEqual({
      screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
      simulcast: true,
      screenShareSimulcastLayers: high.layers,
      degradationPreference: "maintain-resolution",
    });
  });

  it("asks for system or tab sound only when sharing sound", () => {
    const q = screenShareQualities(plus)["720p30"]!;
    expect(captureOptions(q, { echoCancellation: false })).toMatchObject({
      systemAudio: "include",
      suppressLocalAudioPlayback: false,
    });
    expect(captureOptions(q, false)).not.toHaveProperty("systemAudio");
  });
});

describe("display media cap", () => {
  afterEach(() => setDisplayMediaCap(undefined));

  it("publishes no more pixels than voice-ingress accepts", () => {
    // new accounts: video_resolution = [1080, 720] (777 600 px) < 1280×720
    const low = screenShareQualities({
      resolution: [1080, 720],
      framerate: 30,
    })["720p30"]!;
    const start = publishSafeQuality(low, [1080, 720]);
    expect(start.width * start.height).toBeLessThanOrEqual(1080 * 720);
    expect(start.width / start.height).toBeCloseTo(16 / 9, 2);
    expect((start.width % 2) + (start.height % 2)).toBe(0);
    expect(start.encoding).toEqual(low.encoding);
    // within the plan: unchanged
    const high = screenShareQualities(plus)["1080p30"]!;
    expect(publishSafeQuality(high, [1920, 1080])).toEqual(high);
    // unlimited plans are left alone
    const unlimited = screenShareQualities({
      resolution: [0, 0],
      framerate: 30,
    })["1080p30"]!;
    expect(publishSafeQuality(unlimited, [0, 0])).toEqual(unlimited);
  });

  it("clamps requested constraints but keeps the ideal", () => {
    setDisplayMediaCap({ width: 1280, height: 720, frameRate: 30 });
    expect(
      clampDisplayMediaOptions({
        audio: true,
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: 60,
        },
      }),
    ).toEqual({
      audio: true,
      video: {
        width: { ideal: 1920, max: 1280 },
        height: { ideal: 1080, max: 720 },
        frameRate: { ideal: 60, max: 30 },
      },
    });
  });

  it("leaves calls alone without a cap or video", () => {
    const opts = { video: true };
    expect(clampDisplayMediaOptions(opts)).toBe(opts);
    setDisplayMediaCap({ width: 0, height: 0, frameRate: 15 });
    expect(clampDisplayMediaOptions({ video: true })).toEqual({
      video: { frameRate: { max: 15 } },
    });
    expect(clampDisplayMediaOptions({ audio: true })).toEqual({ audio: true });
  });
});

describe("applyQuality", () => {
  it("forces the encoder caps to follow even when the size is unchanged", async () => {
    const calls: string[] = [];
    const track = {
      lastEncodedDimensions: { width: 1920, height: 1080 },
      mediaStreamTrack: {
        getCapabilities: () => ({
          width: { max: 2560 },
          height: { max: 1440 },
        }),
      },
      applyScreenShareConstraints: vi.fn(async function (this: {
        lastEncodedDimensions?: unknown;
      }) {
        calls.push(`apply dims=${JSON.stringify(this.lastEncodedDimensions)}`);
      }),
      setDegradationPreference: vi.fn(async (p: string) =>
        calls.push(`degradation ${p}`),
      ),
    };
    const motion = screenShareQualities(plus, "motion")["1080p60"]!;
    await applyQuality(
      { videoTrack: track } as unknown as Parameters<typeof applyQuality>[0],
      motion,
    );
    expect(calls).toEqual(["apply dims=undefined", "degradation balanced"]);
    expect(track.applyScreenShareConstraints).toHaveBeenCalledWith(
      {
        resolution: { width: 1920, height: 1080, frameRate: 60 },
        contentHint: "motion",
      },
      { maxBitrate: 8_000_000, maxFramerate: 60 },
    );

    const sharp = screenShareQualities(plus, "detail")["720p30"]!;
    await applyQuality(
      { videoTrack: track } as unknown as Parameters<typeof applyQuality>[0],
      sharp,
    );
    expect(track.applyScreenShareConstraints).toHaveBeenLastCalledWith(
      {
        resolution: { width: 1280, height: 720, frameRate: 30 },
        contentHint: "detail",
      },
      { maxBitrate: 2_000_000, maxFramerate: 30 },
    );
  });
});

describe("senderLiveStats", () => {
  it("reports the top layer and why it is limited", async () => {
    const track = {
      getSenderStats: async () => [
        {
          rid: "q",
          frameWidth: 960,
          frameHeight: 540,
          framesPerSecond: 30,
          qualityLimitationReason: "none",
        },
        {
          rid: "h",
          frameWidth: 1920,
          frameHeight: 1080,
          framesPerSecond: 12.4,
          qualityLimitationReason: "bandwidth",
        },
      ],
    };
    expect(
      await senderLiveStats(
        track as unknown as Parameters<typeof senderLiveStats>[0],
      ),
    ).toEqual({
      width: 1920,
      height: 1080,
      fps: 12,
      limitation: "bandwidth",
    });
  });
});

describe("republishCodec", () => {
  it("switches later shares to H.264 once a VP8 video was unpublished", () => {
    const handlers: Record<string, (publication: unknown) => void> = {};
    const room = {
      on: (event: string, fn: (publication: unknown) => void) =>
        (handlers[event] = fn),
    };
    vi.stubGlobal("RTCRtpSender", {
      getCapabilities: () => ({
        codecs: [{ mimeType: "video/VP8" }, { mimeType: "video/H264" }],
      }),
    });
    watchRetiredCodecs(room as unknown as Room);
    watchRetiredCodecs(room as unknown as Room); // registers once
    expect(republishCodec(room as unknown as Room)).toBeUndefined();
    handlers.localTrackUnpublished({ kind: "audio", mimeType: "audio/opus" });
    expect(republishCodec(room as unknown as Room)).toBeUndefined();
    handlers.localTrackUnpublished({ kind: "video", mimeType: "video/H264" });
    expect(republishCodec(room as unknown as Room)).toBeUndefined();
    handlers.localTrackUnpublished({ kind: "video", mimeType: "video/VP8" });
    expect(republishCodec(room as unknown as Room)).toBe("h264");
    vi.unstubAllGlobals();
  });

  it("keeps the default when the browser cannot send H.264", () => {
    const handlers: Record<string, (publication: unknown) => void> = {};
    const room = {
      on: (event: string, fn: (publication: unknown) => void) =>
        (handlers[event] = fn),
    };
    vi.stubGlobal("RTCRtpSender", {
      getCapabilities: () => ({ codecs: [{ mimeType: "video/VP8" }] }),
    });
    watchRetiredCodecs(room as unknown as Room);
    handlers.localTrackUnpublished({ kind: "video" });
    expect(republishCodec(room as unknown as Room)).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
