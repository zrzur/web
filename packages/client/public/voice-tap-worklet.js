"use strict";
// Hands the mixed voices of a call to the page in blocks of a tenth of a
// second, for clips and recorded rooms (components/rtc/capture). It only
// runs while clips are on or a recording runs, and it hears only the voices
// of people who agreed.
class ZrzurVoiceTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4800;
    this.block = new Float32Array(this.size);
    this.fill = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    for (let i = 0; i < 128; i++) {
      this.block[this.fill++] = channel ? channel[i] : 0;
      if (this.fill === this.size) {
        this.port.postMessage(this.block, [this.block.buffer]);
        this.block = new Float32Array(this.size);
        this.fill = 0;
      }
    }
    return true;
  }
}
registerProcessor("zrzur-voice-tap", ZrzurVoiceTap);
