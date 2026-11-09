import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  type GateConfig,
  type GateState,
  AUTO_THRESHOLD_MAX_DB,
  AUTO_THRESHOLD_MIN_DB,
  autoThreshold,
  clampThreshold,
  GATE_HOLD_MS,
  gateStep,
  initialGateState,
  levelDb,
  thresholdPercent,
  voiceGateWorkletSource,
  voiceGateWorkletUrl,
} from "./voiceGate";

/** The worklet as the app serves it (public/, same origin) */
const STATIC_WORKLET = resolve(__dirname, "../../public/voice-gate-worklet.js");

const manual = (thresholdDb: number): GateConfig => ({
  enabled: true,
  auto: false,
  thresholdDb,
  holdMs: GATE_HOLD_MS,
});

/** Feeds levels every `dt` ms and returns the gate's open state after each */
function run(
  levels: number[],
  config: GateConfig,
  dt = 10,
  state: GateState = initialGateState(),
) {
  const opens: boolean[] = [];
  let now = 0;
  for (const level of levels) {
    now += dt;
    state = gateStep(state, level, now, dt, config);
    opens.push(state.open);
  }
  return { opens, state };
}

describe("levelDb", () => {
  it("reads full-scale sine-like samples near 0 dB and silence as the floor", () => {
    expect(levelDb(new Float32Array(128).fill(1))).toBeCloseTo(0, 5);
    expect(levelDb(new Float32Array(128).fill(0.1))).toBeCloseTo(-20, 5);
    expect(levelDb(new Float32Array(128))).toBe(-100);
    expect(levelDb(new Float32Array(0))).toBe(-100);
  });
});

describe("manual threshold", () => {
  it("is closed below the threshold and opens at once above it", () => {
    const { opens } = run([-70, -70, -40], manual(-50));
    expect(opens).toEqual([false, false, true]);
  });

  it("holds open about 300 ms after the voice drops, then closes", () => {
    // speech, then 40 blocks of silence 10 ms apart
    const { opens } = run([-30, ...Array(40).fill(-80)], manual(-50));
    const closedAt = opens.indexOf(false);
    // still open through the hold time so the end of a word is not cut
    expect(closedAt * 10).toBeGreaterThanOrEqual(GATE_HOLD_MS);
    expect(closedAt * 10).toBeLessThanOrEqual(GATE_HOLD_MS + 20);
  });

  it("a short dip between words keeps it open", () => {
    const { opens } = run(
      [-30, ...Array(15).fill(-80), -30, ...Array(5).fill(-80)],
      manual(-50),
    );
    expect(opens.every(Boolean)).toBe(true);
  });

  it("exactly at the threshold counts as above", () => {
    expect(run([-50], manual(-50)).opens).toEqual([true]);
  });
});

describe("disabled (push to talk)", () => {
  it("is always open, whatever the level", () => {
    const { opens } = run([-100, -100, -100], {
      ...manual(0),
      enabled: false,
    });
    expect(opens).toEqual([true, true, true]);
  });
});

describe("automatic", () => {
  const auto: GateConfig = {
    enabled: true,
    auto: true,
    thresholdDb: -10,
    holdMs: GATE_HOLD_MS,
  };

  it("ignores the manual slider value", () => {
    // a manual -10 dB would cut normal speech; automatic lets it through
    const quiet = run(Array(300).fill(-85), auto);
    const { opens } = run([-35], auto, 10, quiet.state);
    expect(opens).toEqual([true]);
  });

  it("closes on near silence once it has learnt the room", () => {
    const { opens } = run(Array(300).fill(-85), auto);
    expect(opens.at(-1)).toBe(false);
  });

  it("never sets its threshold above the cap, so speech always passes in a noisy room", () => {
    // loud fan at -40 dB for ten seconds
    const noisy = run(Array(1000).fill(-40), auto);
    expect(autoThreshold(noisy.state.noiseFloorDb)).toBe(AUTO_THRESHOLD_MAX_DB);
    expect(noisy.opens.at(-1)).toBe(true);
    // ten seconds of continuous speech do not teach it to close on speech
    const talking = run(Array(1000).fill(-30), auto, 10, noisy.state);
    expect(talking.opens.every(Boolean)).toBe(true);
  });

  it("keeps the automatic threshold 6 dB over the room, between -70 and -55 dBFS", () => {
    expect(AUTO_THRESHOLD_MIN_DB).toBe(-70);
    expect(AUTO_THRESHOLD_MAX_DB).toBe(-55);
    expect(autoThreshold(-200)).toBe(AUTO_THRESHOLD_MIN_DB);
    expect(autoThreshold(0)).toBe(AUTO_THRESHOLD_MAX_DB);
    expect(autoThreshold(-70)).toBe(-64);
  });

  it("ten seconds of quiet speech after a quiet room stay open (it does not learn speech as noise)", () => {
    const room = run(Array(300).fill(-70), auto);
    // learnt the room
    expect(room.state.noiseFloorDb).toBeCloseTo(-70, 0);
    const speech = run(Array(1000).fill(-55), auto, 10, room.state);
    expect(speech.opens.every(Boolean)).toBe(true);
    expect(speech.state.noiseFloorDb).toBeLessThan(-66);
  });

  it("a short drop to digital silence does not teach it a silent room", () => {
    const room = run(Array(300).fill(-70), auto);
    const dropout = run(Array(50).fill(-100), auto, 10, room.state);
    const back = run(Array(300).fill(-70), auto, 10, dropout.state);
    expect(back.state.noiseFloorDb).toBeCloseTo(-70, 0);
    expect(back.opens.at(-1)).toBe(false);
  });

  it("follows a room that gets a little louder", () => {
    const room = run(Array(300).fill(-75), auto);
    const fan = run(Array(1500).fill(-66), auto, 10, room.state);
    expect(fan.state.noiseFloorDb).toBeGreaterThan(-68);
    expect(fan.opens.at(-1)).toBe(false);
  });
});

describe("settings helpers", () => {
  it("clamps stored thresholds to the slider range", () => {
    expect(clampThreshold(-200)).toBe(-80);
    expect(clampThreshold(5)).toBe(0);
    expect(clampThreshold(Number.NaN)).toBe(-50);
    expect(clampThreshold(-42)).toBe(-42);
  });

  it("places a level on the meter from 0 to 100 %", () => {
    expect(thresholdPercent(-80)).toBe(0);
    expect(thresholdPercent(0)).toBe(100);
    expect(thresholdPercent(-40)).toBe(50);
    expect(thresholdPercent(-120)).toBe(0);
  });
});

describe("static worklet file", () => {
  it("public/voice-gate-worklet.js is the current kernel (UPDATE_VOICE_GATE_WORKLET=1 rewrites it)", () => {
    if (process.env.UPDATE_VOICE_GATE_WORKLET)
      writeFileSync(STATIC_WORKLET, voiceGateWorkletSource());
    expect(readFileSync(STATIC_WORKLET, "utf8")).toBe(voiceGateWorkletSource());
  });

  it("is loaded from this origin, with a version that changes with the code", () => {
    const url = voiceGateWorkletUrl();
    expect(url).toMatch(/^\/voice-gate-worklet\.js\?v=[0-9a-z]+$/);
    expect(url).toBe(voiceGateWorkletUrl());
  });
});

describe("audio worklet source", () => {
  /** Runs the generated worklet in a fake AudioWorkletGlobalScope */
  function loadWorklet() {
    const registered: Record<string, unknown> = {};
    const scope = {
      sampleRate: 48000,
      registerProcessor: (name: string, ctor: unknown) => {
        registered[name] = ctor;
      },
      AudioWorkletProcessor: class {
        port = {
          onmessage: undefined as unknown,
          sent: [] as unknown[],
          postMessage(message: unknown) {
            this.sent.push(message);
          },
        };
      },
    };
    new Function(
      "sampleRate",
      "registerProcessor",
      "AudioWorkletProcessor",
      "scope",
      readFileSync(STATIC_WORKLET, "utf8"),
    )(
      scope.sampleRate,
      scope.registerProcessor,
      scope.AudioWorkletProcessor,
      scope,
    );
    type Processor = {
      port: {
        onmessage: (event: { data: unknown }) => void;
        sent: { level: number; open: boolean }[];
      };
      process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    };
    const Ctor = registered["zrzur-voice-gate"] as new () => Processor;
    return { Ctor };
  }

  /** Runs `blocks` 128-sample blocks of a constant amplitude */
  function feed(
    p: { process(i: Float32Array[][], o: Float32Array[][]): boolean },
    amplitude: number,
    blocks: number,
  ) {
    let out = new Float32Array(128);
    for (let i = 0; i < blocks; i++) {
      out = new Float32Array(128);
      p.process([[new Float32Array(128).fill(amplitude)]], [[out]]);
    }
    return out;
  }

  it("registers the gate and silences sound under a manual threshold", () => {
    const { Ctor } = loadWorklet();
    const p = new Ctor();
    p.port.onmessage({
      data: { enabled: true, auto: false, thresholdDb: -30, holdMs: 300 },
    });
    // -40 dB, under the -30 dB threshold: silence after the fade
    const quiet = feed(p, 0.01, 200);
    expect(Math.max(...quiet.map(Math.abs))).toBeLessThan(1e-4);
    // -20 dB, above it: passes unchanged after the fade in
    const loud = feed(p, 0.1, 20);
    expect(loud[127]).toBeCloseTo(0.1, 4);
  });

  it("passes everything when disabled and reports levels to the page", () => {
    const { Ctor } = loadWorklet();
    const p = new Ctor();
    p.port.onmessage({
      data: { enabled: false, auto: false, thresholdDb: 0, holdMs: 300 },
    });
    const out = feed(p, 0.01, 50);
    expect(out[127]).toBeCloseTo(0.01, 5);
    const last = p.port.sent.at(-1)!;
    expect(last.level).toBeCloseTo(-40, 0);
    expect(last.open).toBe(true);
  });

  it("keeps running with no input connected", () => {
    const { Ctor } = loadWorklet();
    const p = new Ctor();
    expect(p.process([[]], [[new Float32Array(128)]])).toBe(true);
  });
});
