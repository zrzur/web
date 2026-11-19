import { describe, expect, it } from "vitest";

import {
  type CaptureAllowance,
  type CaptureItem,
  type CaptureState,
  NO_CAPTURE,
  captureActive,
  captureFileName,
  captureState,
  clipBlock,
  clock,
  engineJob,
  mayDelete,
  recordingSecondsLeft,
  shouldAsk,
  voicesToMix,
} from "./captureModel";

const allowance: CaptureAllowance = {
  clip_seconds: 30,
  clips_left: 3,
  clips_per_month: 10,
  recording_seconds_left: 1800,
  recording_seconds_per_month: 18_000,
  episode_max_seconds: 3600,
  opt_in: true,
};

const clipsOn: CaptureState = { clips: "maker", included: ["a", "b"] };
const recording: CaptureState = {
  recording: { by: "host", started_at: 1_000_000 },
  included: ["host"],
};

describe("what came over the wire", () => {
  it("is tidied into a state", () => {
    expect(captureState(undefined)).toEqual(NO_CAPTURE);
    expect(captureState({ clips: null, included: null })).toEqual(NO_CAPTURE);
    expect(
      captureState({ clips: "x", included: ["a", 5, null, "b"], extra: 1 }),
    ).toEqual({ clips: "x", recording: undefined, included: ["a", "b"] });
    expect(captureState({ recording: { started_at: 5 } }).recording).toBe(
      undefined,
    );
  });
});

describe("whose voice is saved", () => {
  it("is nobody while nothing is on", () => {
    expect(captureActive(NO_CAPTURE)).toBe(false);
    expect(voicesToMix({ included: ["a"] }, ["a"])).toEqual([]);
  });

  it("is only people who are included and present", () => {
    expect(voicesToMix(clipsOn, ["a", "b", "c"])).toEqual(["a", "b"]);
    expect(voicesToMix(clipsOn, ["c", "b"])).toEqual(["b"]);
    expect(voicesToMix(clipsOn, [])).toEqual([]);
  });

  it("never includes someone who did not agree, however they are passed", () => {
    expect(voicesToMix(clipsOn, ["c", "c", "d"])).toEqual([]);
    expect(voicesToMix({ clips: "maker", included: [] }, ["maker"])).toEqual(
      [],
    );
  });

  it("drops a voice the moment its owner is no longer included", () => {
    const before = voicesToMix(clipsOn, ["a", "b"]);
    const after = voicesToMix({ ...clipsOn, included: ["a"] }, ["a", "b"]);
    expect(before).toEqual(["a", "b"]);
    expect(after).toEqual(["a"]);
  });
});

describe("what this device does", () => {
  it("keeps the last seconds only while clips are on", () => {
    expect(engineJob(NO_CAPTURE, "a")).toEqual({ buffer: false, record: false });
    expect(engineJob(clipsOn, "a")).toEqual({ buffer: true, record: false });
  });

  it("records only on the device of the person who started", () => {
    expect(engineJob(recording, "host").record).toBe(true);
    expect(engineJob(recording, "guest").record).toBe(false);
  });
});

describe("asking for the choice", () => {
  it("asks once something is on, and not again after an answer", () => {
    expect(shouldAsk(NO_CAPTURE, false)).toBe(false);
    expect(shouldAsk(clipsOn, false)).toBe(true);
    expect(shouldAsk(recording, false)).toBe(true);
    expect(shouldAsk(clipsOn, true)).toBe(false);
  });
});

describe("saving a clip", () => {
  const base = { state: clipsOn, allowance, bufferedSeconds: 30, saving: false };

  it("is possible with clips on, room in the month and something buffered", () => {
    expect(clipBlock(base)).toBe(undefined);
    expect(clipBlock({ ...base, allowance: undefined })).toBe(undefined);
  });

  it("says why not", () => {
    expect(clipBlock({ ...base, state: NO_CAPTURE })).toBe("off");
    expect(clipBlock({ ...base, saving: true })).toBe("busy");
    expect(
      clipBlock({ ...base, allowance: { ...allowance, clips_left: 0 } }),
    ).toBe("limit");
    expect(clipBlock({ ...base, bufferedSeconds: 0.4 })).toBe("empty");
  });
});

describe("how long a recording may go on", () => {
  const live = { by: "host", started_at: 1_000_000 };

  it("is the month's rest when that is shorter than an episode", () => {
    expect(recordingSecondsLeft(live, allowance, 1_000_000)).toBe(1800);
    expect(recordingSecondsLeft(live, allowance, 1_000_000 + 600_000)).toBe(
      1200,
    );
  });

  it("is the longest episode when the month has more", () => {
    expect(
      recordingSecondsLeft(
        live,
        { episode_max_seconds: 3600, recording_seconds_left: 90_000 },
        1_000_000 + 60_000,
      ),
    ).toBe(3540);
  });

  it("never goes below zero", () => {
    expect(recordingSecondsLeft(live, allowance, 99_000_000)).toBe(0);
  });
});

describe("small things", () => {
  it("shows time as a clock", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75.9)).toBe("1:15");
    expect(clock(3725)).toBe("1:02:05");
    expect(clock(-3)).toBe("0:00");
  });

  it("names files by kind and time", () => {
    expect(
      captureFileName("clip", new Date(Date.UTC(2026, 10, 19, 8, 5, 9))),
    ).toBe("clip-20261119-080509.ogg");
  });

  it("lets the author, the people in it and moderators delete", () => {
    const item = { author: "a", included: ["a", "b"] } as CaptureItem;
    expect(mayDelete(item, "a", false)).toBe(true);
    expect(mayDelete(item, "b", false)).toBe(true);
    expect(mayDelete(item, "c", false)).toBe(false);
    expect(mayDelete(item, "c", true)).toBe(true);
  });
});
