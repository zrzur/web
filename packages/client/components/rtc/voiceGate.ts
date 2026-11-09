/**
 * Input sensitivity: a noise gate on the outgoing microphone.
 *
 * Below the threshold the call carries silence (the microphone stays
 * published and unmuted, so nothing flickers in the call); the speaking
 * indicator follows because it is measured on the sound that is sent.
 * After the voice drops, the gate stays open for a short hold time so the
 * end of a word is not cut.
 *
 * The logic is one self-contained kernel: the page uses it for tests and
 * the settings meter, and the audio worklet runs the very same code (its
 * source is the kernel's own text), so both always agree.
 */

/** dBFS that silence reads as */
export const SILENCE_DB = -100;
/** Slider range of the manual threshold (dBFS) */
export const THRESHOLD_MIN_DB = -80;
export const THRESHOLD_MAX_DB = 0;
/** Manual threshold of someone who never moved the slider */
export const DEFAULT_THRESHOLD_DB = -50;
/** How long the gate stays open after the voice drops */
export const GATE_HOLD_MS = 300;
/** Automatic mode stays between these bounds; the cap keeps speech passing */
export const AUTO_THRESHOLD_MIN_DB = -70;
export const AUTO_THRESHOLD_MAX_DB = -55;

export interface GateConfig {
  /** Off in push to talk: the key decides, the gate stays open */
  enabled: boolean;
  /** Learn the room's noise instead of using the slider */
  auto: boolean;
  /** Manual threshold in dBFS */
  thresholdDb: number;
  holdMs: number;
}

export interface GateState {
  open: boolean;
  /** Time the level was last at or above the threshold (ms) */
  lastAboveMs: number;
  /** Learnt background noise level (automatic mode, dBFS; NaN until heard) */
  noiseFloorDb: number;
  /** Quietest level of the current one-second window */
  windowMinDb: number;
  /** Quietest level of the window before it */
  previousMinDb: number;
  /** Time spent in the current window (ms) */
  windowMs: number;
}

/**
 * Everything the worklet needs, with no reference to anything outside
 * itself (its text is copied into the worklet). Plain ES2015, no helpers.
 */
function gateKernel() {
  const SILENCE = -100;
  const AUTO_MIN = -70;
  const AUTO_MAX = -55;
  /** Automatic threshold sits this far above the learnt noise */
  const AUTO_MARGIN = 6;
  /**
   * Minimum tracking: the room is the quietest level of the last one to two
   * seconds. The floor follows it down fast, and up slowly only while it
   * stays near the floor (a quieter room, a fan turned up a little); a
   * minimum far above the floor is speech without pauses and is ignored.
   */
  const WINDOW_MS = 1000;
  const FLOOR_DOWN_MS = 200;
  const FLOOR_UP_MS = 2000;
  const RISE_BAND = 12;
  /** Digital silence (a muted or switching device) says nothing about the room */
  const DIGITAL_SILENCE = -90;

  function levelDb(samples: ArrayLike<number>): number {
    const n = samples.length;
    if (!n) return SILENCE;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / n);
    if (rms <= 0) return SILENCE;
    return Math.max(SILENCE, 20 * Math.log10(rms));
  }

  function autoThreshold(noiseFloorDb: number): number {
    if (!(noiseFloorDb > -1000)) return AUTO_MIN;
    return Math.min(AUTO_MAX, Math.max(AUTO_MIN, noiseFloorDb + AUTO_MARGIN));
  }

  function initialGateState(): GateState {
    return {
      open: true,
      lastAboveMs: -1e12,
      noiseFloorDb: NaN,
      windowMinDb: 1000,
      previousMinDb: 1000,
      windowMs: 0,
    };
  }

  function gateStep(
    state: GateState,
    level: number,
    nowMs: number,
    dtMs: number,
    config: GateConfig,
  ): GateState {
    let windowMin = state.windowMinDb;
    let previousMin = state.previousMinDb;
    let windowMs = state.windowMs + dtMs;
    if (level > DIGITAL_SILENCE) windowMin = Math.min(windowMin, level);
    if (windowMs >= WINDOW_MS) {
      previousMin = windowMin;
      windowMin = 1000;
      windowMs = 0;
    }
    const roomMin = Math.min(windowMin, previousMin);

    let floor = state.noiseFloorDb;
    if (roomMin < 1000) {
      if (!(floor > -1000)) floor = roomMin;
      else if (roomMin < floor)
        floor += (roomMin - floor) * Math.min(1, dtMs / FLOOR_DOWN_MS);
      else if (roomMin < floor + RISE_BAND)
        floor += (roomMin - floor) * Math.min(1, dtMs / FLOOR_UP_MS);
    }

    const next = {
      open: true,
      lastAboveMs: nowMs,
      noiseFloorDb: floor,
      windowMinDb: windowMin,
      previousMinDb: previousMin,
      windowMs: windowMs,
    };
    if (!config.enabled) return next;
    const threshold = config.auto ? autoThreshold(floor) : config.thresholdDb;
    next.lastAboveMs = level >= threshold ? nowMs : state.lastAboveMs;
    next.open = nowMs - next.lastAboveMs < config.holdMs;
    return next;
  }

  return {
    levelDb: levelDb,
    autoThreshold: autoThreshold,
    initialGateState: initialGateState,
    gateStep: gateStep,
  };
}

const kernel = gateKernel();

/** RMS level of a block of samples in dBFS (silence reads -100) */
export const levelDb = kernel.levelDb;
/** Threshold automatic mode uses for a learnt noise floor */
export const autoThreshold = kernel.autoThreshold;
/** A gate that has heard nothing yet (open until it has a reason to close) */
export const initialGateState = kernel.initialGateState;
/** Advance the gate by one measured block */
export const gateStep = kernel.gateStep;

/** A stored threshold, kept inside the slider's range */
export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THRESHOLD_DB;
  return Math.min(THRESHOLD_MAX_DB, Math.max(THRESHOLD_MIN_DB, value));
}

/** Where a level sits on the meter (0–100 %) */
export function thresholdPercent(db: number): number {
  return (
    ((clampThreshold(db) - THRESHOLD_MIN_DB) /
      (THRESHOLD_MAX_DB - THRESHOLD_MIN_DB)) *
    100
  );
}

/** Name the worklet registers under */
export const VOICE_GATE_WORKLET = "zrzur-voice-gate";

/**
 * The worklet file in public/ (same origin, so a `script-src 'self'` policy
 * keeps it working). It is voiceGateWorkletSource() written out; a unit
 * test fails when the two differ.
 */
export const VOICE_GATE_WORKLET_FILE = "voice-gate-worklet.js";

/** Address of the worklet, versioned by its content so updates are fetched */
export function voiceGateWorkletUrl(): string {
  const source = voiceGateWorkletSource();
  let hash = 5381;
  for (let i = 0; i < source.length; i++)
    hash = ((hash * 33) ^ source.charCodeAt(i)) >>> 0;
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base}${VOICE_GATE_WORKLET_FILE}?v=${hash.toString(36)}`;
}

/**
 * Source of the audio worklet: the kernel above, a short fade so opening
 * and closing never click, and a level report to the page every ~50 ms.
 */
export function voiceGateWorkletSource(): string {
  return `"use strict";
var kernel = (${gateKernel.toString()})();
var ATTACK_MS = 5;
var RELEASE_MS = 30;
var REPORT_MS = 50;
class VoiceGate extends AudioWorkletProcessor {
  constructor() {
    super();
    var self = this;
    this.config = { enabled: true, auto: true, thresholdDb: ${DEFAULT_THRESHOLD_DB}, holdMs: ${GATE_HOLD_MS} };
    this.state = kernel.initialGateState();
    this.gain = 1;
    this.nowMs = 0;
    this.sinceReport = 0;
    this.peak = -100;
    this.port.onmessage = function (event) {
      var c = event.data || {};
      self.config = {
        enabled: c.enabled !== false,
        auto: c.auto !== false,
        thresholdDb: typeof c.thresholdDb === "number" ? c.thresholdDb : ${DEFAULT_THRESHOLD_DB},
        holdMs: typeof c.holdMs === "number" ? c.holdMs : ${GATE_HOLD_MS},
      };
    };
  }
}
VoiceGate.prototype.process = function (inputs, outputs) {
  var input = inputs[0] || [];
  var output = outputs[0] || [];
  var frames = output.length ? output[0].length : 128;
  var dtMs = (frames / sampleRate) * 1000;
  this.nowMs += dtMs;
  var level = input.length ? kernel.levelDb(input[0]) : -100;
  this.state = kernel.gateStep(this.state, level, this.nowMs, dtMs, this.config);
  var target = this.state.open ? 1 : 0;
  var ms = target > this.gain ? ATTACK_MS : RELEASE_MS;
  var stepPerSample = 1 / ((ms / 1000) * sampleRate);
  for (var ch = 0; ch < output.length; ch++) {
    var src = input[ch] || input[0];
    var dst = output[ch];
    var g = this.gain;
    for (var i = 0; i < dst.length; i++) {
      if (g < target) g = Math.min(target, g + stepPerSample);
      else if (g > target) g = Math.max(target, g - stepPerSample);
      dst[i] = src ? src[i] * g : 0;
    }
    if (ch === output.length - 1) this.gain = g;
  }
  this.peak = Math.max(this.peak, level);
  this.sinceReport += dtMs;
  if (this.sinceReport >= REPORT_MS) {
    this.port.postMessage({ level: this.peak, open: this.state.open });
    this.sinceReport = 0;
    this.peak = -100;
  }
  return true;
};
registerProcessor("${VOICE_GATE_WORKLET}", VoiceGate);
`;
}
