import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEAK_NETWORK,
  GOOD_NETWORK,
  type NetworkSample,
  type NetworkState,
  lightVoiceBitrate,
  lossBetween,
  nextNetworkState,
  planFor,
  rateSample,
  weakNetworkSettings,
} from "./weakNetwork";

const S = DEFAULT_WEAK_NETWORK;

/** Feed samples two seconds apart, starting at `from` */
function run(
  state: NetworkState,
  samples: Omit<NetworkSample, "at">[],
  from = 0,
) {
  let at = from;
  for (const sample of samples) {
    state = nextNetworkState(state, { ...sample, at }, S);
    at += 2000;
  }
  return state;
}

describe("rating one sample", () => {
  it("is good without any sign of trouble", () => {
    expect(rateSample({ at: 0 }, S)).toBe("good");
    expect(rateSample({ at: 0, lossPercent: 1, rttMs: 120 }, S)).toBe("good");
    expect(rateSample({ at: 0, quality: "excellent" }, S)).toBe("good");
  });

  it("takes the worst of loss, delay and the server's verdict", () => {
    expect(rateSample({ at: 0, lossPercent: 5 }, S)).toBe("weak");
    expect(rateSample({ at: 0, lossPercent: 15 }, S)).toBe("bad");
    expect(rateSample({ at: 0, rttMs: 400 }, S)).toBe("weak");
    expect(rateSample({ at: 0, rttMs: 900, lossPercent: 0 }, S)).toBe("bad");
    expect(rateSample({ at: 0, quality: "poor", lossPercent: 0 }, S)).toBe(
      "weak",
    );
    expect(rateSample({ at: 0, quality: "lost" }, S)).toBe("bad");
    expect(rateSample({ at: 0, quality: "poor", lossPercent: 20 }, S)).toBe(
      "bad",
    );
  });
});

describe("moving between levels", () => {
  it("ignores a single bad sample", () => {
    const state = run(GOOD_NETWORK, [{ lossPercent: 30 }, { lossPercent: 0 }]);
    expect(state.level).toBe("good");
    expect(state.worseCount).toBe(0);
  });

  it("steps down one level at a time, never straight to audio only", () => {
    const bad = { lossPercent: 30 };
    expect(run(GOOD_NETWORK, [bad]).level).toBe("good");
    expect(run(GOOD_NETWORK, [bad, bad]).level).toBe("weak");
    expect(run(GOOD_NETWORK, [bad, bad, bad]).level).toBe("weak");
    expect(run(GOOD_NETWORK, [bad, bad, bad, bad]).level).toBe("bad");
    // and no further
    expect(run(GOOD_NETWORK, Array(10).fill(bad)).level).toBe("bad");
  });

  it("stays weak on a connection that is only weak", () => {
    expect(run(GOOD_NETWORK, Array(10).fill({ lossPercent: 7 })).level).toBe(
      "weak",
    );
  });

  it("steps back up only after the recovery time, one level at a time", () => {
    const bad = run(GOOD_NETWORK, Array(4).fill({ lossPercent: 30 }));
    expect(bad.level).toBe("bad");
    const good = { lossPercent: 0, rttMs: 80 };
    // 2 s apart: five samples span 8 s, six span 10 s
    expect(run(bad, Array(5).fill(good), 100_000).level).toBe("bad");
    expect(run(bad, Array(6).fill(good), 100_000).level).toBe("weak");
    expect(run(bad, Array(11).fill(good), 100_000).level).toBe("weak");
    expect(run(bad, Array(12).fill(good), 100_000).level).toBe("good");
  });

  it("starts the recovery time again after a relapse", () => {
    const weak = run(GOOD_NETWORK, Array(2).fill({ lossPercent: 7 }));
    const good = { lossPercent: 0 };
    const state = run(
      weak,
      [good, good, good, good, { lossPercent: 7 }, good, good, good, good, good],
      50_000,
    );
    expect(state.level).toBe("weak");
  });

  it("does not move without numbers (a silent call)", () => {
    expect(run(GOOD_NETWORK, Array(20).fill({})).level).toBe("good");
  });
});

describe("what happens at each level", () => {
  it("changes nothing on a good connection", () => {
    expect(planFor("good", 64_000, false, S)).toEqual({
      sign: false,
      audioBitrate: 64_000,
      remoteVideo: "auto",
      ownVideo: "full",
    });
  });

  it("lowers video and lightens voice when weak", () => {
    expect(planFor("weak", 64_000, false, S)).toEqual({
      sign: true,
      audioBitrate: 24_000,
      remoteVideo: "low",
      ownVideo: "low",
    });
  });

  it("pauses video and keeps audio when very weak", () => {
    const plan = planFor("bad", 64_000, false, S);
    expect(plan).toEqual({
      sign: true,
      audioBitrate: 16_000,
      remoteVideo: "off",
      ownVideo: "paused",
    });
    expect(plan.audioBitrate).toBeGreaterThan(0);
  });

  it("never raises a bitrate that is already lower", () => {
    expect(planFor("weak", 16_000, false, S).audioBitrate).toBe(16_000);
    expect(planFor("bad", 12_000, false, S).audioBitrate).toBe(12_000);
  });

  it("keeps music clearer than speech", () => {
    expect(planFor("weak", 128_000, true, S).audioBitrate).toBe(128_000);
    expect(planFor("bad", 128_000, true, S).audioBitrate).toBe(48_000);
  });
});

describe("settings from the server", () => {
  it("uses the defaults for what is missing or senseless", () => {
    expect(weakNetworkSettings(undefined)).toEqual(S);
    expect(
      weakNetworkSettings({
        weak_loss_percent: 8,
        recover_seconds: 0,
        weak_rtt_ms: Number.NaN,
      }),
    ).toEqual({ ...S, weak_loss_percent: 8 });
  });

  it("never makes very weak easier to reach than weak", () => {
    const settings = weakNetworkSettings({
      weak_loss_percent: 20,
      bad_loss_percent: 10,
      weak_audio_bitrate: 12_000,
      bad_audio_bitrate: 20_000,
    });
    expect(settings.bad_loss_percent).toBe(20);
    expect(settings.bad_audio_bitrate).toBe(12_000);
  });

  it("gives low-data mode the weak level's voice bitrate", () => {
    expect(lightVoiceBitrate()).toBe(24_000);
    expect(lightVoiceBitrate({ weak_audio_bitrate: 20_000 })).toBe(20_000);
  });
});

describe("loss between two readings", () => {
  it("is the share of lost packets", () => {
    expect(
      lossBetween({ lost: 10, received: 100 }, { lost: 20, received: 190 }),
    ).toBe(10);
    expect(
      lossBetween({ lost: 0, received: 0 }, { lost: 0, received: 100 }),
    ).toBe(0);
  });

  it("is unknown at the first reading and when almost nothing arrived", () => {
    expect(lossBetween(undefined, { lost: 5, received: 100 })).toBeUndefined();
    expect(
      lossBetween({ lost: 0, received: 100 }, { lost: 1, received: 102 }),
    ).toBeUndefined();
  });

  it("survives counters that were reset", () => {
    expect(
      lossBetween({ lost: 50, received: 500 }, { lost: 0, received: 100 }),
    ).toBeUndefined();
  });
});
