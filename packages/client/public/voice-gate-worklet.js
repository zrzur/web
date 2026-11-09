"use strict";
var kernel = (function gateKernel() {
  const SILENCE = -100;
  const AUTO_MIN = -70;
  const AUTO_MAX = -55;
  const AUTO_MARGIN = 6;
  const WINDOW_MS = 1e3;
  const FLOOR_DOWN_MS = 200;
  const FLOOR_UP_MS = 2e3;
  const RISE_BAND = 12;
  const DIGITAL_SILENCE = -90;
  function levelDb2(samples) {
    const n = samples.length;
    if (!n) return SILENCE;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / n);
    if (rms <= 0) return SILENCE;
    return Math.max(SILENCE, 20 * Math.log10(rms));
  }
  function autoThreshold2(noiseFloorDb) {
    if (!(noiseFloorDb > -1e3)) return AUTO_MIN;
    return Math.min(AUTO_MAX, Math.max(AUTO_MIN, noiseFloorDb + AUTO_MARGIN));
  }
  function initialGateState2() {
    return {
      open: true,
      lastAboveMs: -1e12,
      noiseFloorDb: NaN,
      windowMinDb: 1e3,
      previousMinDb: 1e3,
      windowMs: 0
    };
  }
  function gateStep2(state, level, nowMs, dtMs, config) {
    let windowMin = state.windowMinDb;
    let previousMin = state.previousMinDb;
    let windowMs = state.windowMs + dtMs;
    if (level > DIGITAL_SILENCE) windowMin = Math.min(windowMin, level);
    if (windowMs >= WINDOW_MS) {
      previousMin = windowMin;
      windowMin = 1e3;
      windowMs = 0;
    };
    const roomMin = Math.min(windowMin, previousMin);
    let floor = state.noiseFloorDb;
    if (roomMin < 1e3) {
      if (!(floor > -1e3)) floor = roomMin;
      else if (roomMin < floor)
        floor += (roomMin - floor) * Math.min(1, dtMs / FLOOR_DOWN_MS);
      else if (roomMin < floor + RISE_BAND)
        floor += (roomMin - floor) * Math.min(1, dtMs / FLOOR_UP_MS);
    };
    const next = {
      open: true,
      lastAboveMs: nowMs,
      noiseFloorDb: floor,
      windowMinDb: windowMin,
      previousMinDb: previousMin,
      windowMs
    };
    if (!config.enabled) return next;
    const threshold = config.auto ? autoThreshold2(floor) : config.thresholdDb;
    next.lastAboveMs = level >= threshold ? nowMs : state.lastAboveMs;
    next.open = nowMs - next.lastAboveMs < config.holdMs;
    return next;
  }
  return {
    levelDb: levelDb2,
    autoThreshold: autoThreshold2,
    initialGateState: initialGateState2,
    gateStep: gateStep2
  };
})();
var ATTACK_MS = 5;
var RELEASE_MS = 30;
var REPORT_MS = 50;
class VoiceGate extends AudioWorkletProcessor {
  constructor() {
    super();
    var self = this;
    this.config = { enabled: true, auto: true, thresholdDb: -50, holdMs: 300 };
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
        thresholdDb: typeof c.thresholdDb === "number" ? c.thresholdDb : -50,
        holdMs: typeof c.holdMs === "number" ? c.holdMs : 300,
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
registerProcessor("zrzur-voice-gate", VoiceGate);
