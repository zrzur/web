/**
 * Voice messages are ordinary audio attachments whose file name starts with
 * "voice-message". The name only changes how the file is shown (a compact
 * player with a waveform); the file itself goes through the media server
 * like any other upload.
 */
export const VOICE_PREFIX = "voice-message";

/** Number of bars in a voice message waveform */
export const WAVEFORM_BARS = 40;

/** Longest recording, in seconds */
export const MAX_VOICE_SECONDS = 300;

export function isVoiceMessageName(name: string | undefined) {
  return !!name && /^voice-message-\d+\.(ogg|webm|m4a|mp4)$/i.test(name);
}

/** Recording formats in order of preference, with the file extension */
const FORMATS: [mime: string, ext: string][] = [
  ["audio/ogg;codecs=opus", "ogg"],
  ["audio/webm;codecs=opus", "webm"],
  ["audio/mp4", "m4a"],
];

export function pickVoiceFormat() {
  if (typeof MediaRecorder === "undefined") return;
  return FORMATS.find(([mime]) => MediaRecorder.isTypeSupported(mime));
}

/** Shrink samples to `count` bars between 0 and 1 (loudest bar = 1) */
export function toBars(samples: ArrayLike<number>, count = WAVEFORM_BARS) {
  const bars: number[] = [];
  const size = Math.max(1, Math.floor(samples.length / count));
  for (let bar = 0; bar < count; bar++) {
    let sum = 0;
    const start = bar * size;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    bars.push(end > start ? Math.sqrt(sum / (end - start)) : 0);
  }
  const max = Math.max(...bars, 1e-6);
  return bars.map((value) => Math.max(0.08, value / max));
}

/** Stand-in bars when the audio can't be read: stable for the same file */
export function placeholderBars(seed: string, count = WAVEFORM_BARS) {
  let hash = 2166136261;
  for (const char of seed)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Array.from({ length: count }, (_, i) => {
    hash = Math.imul(hash ^ (i + 1), 2654435761);
    return 0.2 + ((hash >>> 0) % 1000) / 1250;
  });
}

const cache = new Map<string, Promise<{ bars: number[]; duration: number }>>();

/**
 * Read the file once to draw its waveform and get a reliable duration
 * (recorded WebM files often report an unknown length to <audio>)
 */
export function readVoice(url: string) {
  let entry = cache.get(url);
  if (!entry) {
    entry = (async () => {
      const response = await fetch(url, { credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const context = new OfflineAudioContext(1, 1, 48000);
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      return {
        bars: toBars(audio.getChannelData(0)),
        duration: audio.duration,
      };
    })();
    entry.catch(() => cache.delete(url));
    cache.set(url, entry);
  }
  return entry;
}
