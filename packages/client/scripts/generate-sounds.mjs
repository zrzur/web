/**
 * Generates Zrzur's interface sounds (original, synthesised here, no
 * third-party audio). Output: scripts/assets_fallback/sounds/<name>.wav,
 * which copyAssets.mjs serves as public/assets/sounds.
 *
 *   node scripts/generate-sounds.mjs
 *
 * The upstream fallback set only ships byte-identical one-second silent .ogg
 * placeholders for every event except the message sound (the real files live
 * in the private upstream brand-asset submodule, which Zrzur doesn't use),
 * which is why most sound previews were inaudible. Deterministic: same input,
 * same bytes.
 *
 * Voice: soft "glass" tones, a sine fundamental with a quiet octave partial,
 * short attack and exponential decay. Pairs move up for "on/join/start" and
 * down for "off/leave/end", so related events sound related.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "assets_fallback",
  "sounds",
);

/** equal-tempered frequency of a note name like "E5" */
function hz(note) {
  const names = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  const semis =
    names[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (m[3] - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/**
 * Render a sequence of tones
 * @param tones [{ note, at (s), len (s), gain, partial }]
 * @param total Total length in seconds
 */
function render(tones, total) {
  const out = new Float64Array(Math.ceil(total * RATE));
  for (const t of tones) {
    const f = hz(t.note);
    const start = Math.round(t.at * RATE);
    const len = Math.round(t.len * RATE);
    const attack = Math.round(0.006 * RATE);
    const partial = t.partial ?? 0.18;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const time = i / RATE;
      const env =
        (i < attack ? i / attack : 1) * Math.exp((-time * 5.2) / t.len);
      // a slight downward glide keeps the tone from sounding like a test beep
      const glide = 1 - 0.004 * (time / t.len);
      const phase = 2 * Math.PI * f * glide * time;
      out[start + i] +=
        (t.gain ?? 1) *
        env *
        (Math.sin(phase) + partial * Math.sin(2 * phase) +
          0.05 * Math.sin(3 * phase));
    }
  }
  // 8ms fade-out guard so nothing clicks at the end
  const fade = Math.round(0.008 * RATE);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

/** Normalise to a target peak and encode 16-bit mono PCM WAV */
function wav(samples, peak = 0.5) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const scale = max ? peak / max : 0;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * scale)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const seq = (notes, step, len, gain = 1) =>
  notes.map((note, i) => ({ note, at: i * step, len, gain }));

const SOUNDS = {
  // microphone: short two-note blips
  mute: [seq(["E5", "B4"], 0.07, 0.16), 0.28],
  unmute: [seq(["B4", "E5"], 0.07, 0.16), 0.28],
  // deafen: same shape, lower and a third longer, so it reads as "bigger"
  deafen: [seq(["G4", "D4", "G3"], 0.075, 0.2), 0.42],
  undeafen: [seq(["G3", "D4", "G4"], 0.075, 0.2), 0.42],
  // people: warm two-tone chime
  user_join_voice: [seq(["C5", "G5"], 0.11, 0.34), 0.56],
  user_leave_voice: [seq(["G5", "C5"], 0.11, 0.34, 0.85), 0.56],
  user_moved: [seq(["E5", "E5"], 0.1, 0.18, 0.8), 0.36],
  // streams: three-note arpeggio
  stream_start: [seq(["C5", "E5", "G5"], 0.085, 0.3), 0.58],
  stream_end: [seq(["G5", "E5", "C5"], 0.085, 0.3, 0.9), 0.58],
  stream_viewer_join: [seq(["A5"], 0, 0.22), 0.26],
  stream_viewer_leave: [seq(["E5"], 0, 0.22, 0.85), 0.26],
  // calls: one ring cycle each (the player loops it when ringing)
  ringtone_incoming: [
    [
      ...seq(["E5", "G5", "C6"], 0.12, 0.38),
      ...seq(["E5", "G5", "C6"], 0.12, 0.38).map((t) => ({ ...t, at: t.at + 0.8 })),
    ],
    2.0,
  ],
  ringtone_outgoing: [seq(["A4", "A4"], 0.42, 0.36, 0.8), 1.6],
};

mkdirSync(OUT, { recursive: true });
for (const [name, [tones, total]] of Object.entries(SOUNDS)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(render(tones, total)));
  console.log(name.padEnd(20), `${total.toFixed(2)}s`);
}
