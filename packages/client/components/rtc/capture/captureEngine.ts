/**
 * Puts the voices of a call together on this device, encodes them as Opus,
 * and keeps the last seconds ready for a clip or the whole run for an
 * episode. Nothing leaves the device from here: a file is only made when
 * the person presses the button.
 *
 * Only the tracks handed to `setVoices` are heard, and the caller hands in
 * only people who agreed (captureModel.voicesToMix). When a voice is taken
 * out, the seconds kept for clips are dropped with it, so a clip never
 * holds someone who is no longer included.
 */
import {
  CUT_PRE_SKIP,
  OPUS_RATE,
  type OpusPacket,
  PacketRing,
  muxOggOpus,
  packetsSeconds,
} from "./oggOpus";

/** Bitrate of clips and episodes: clear speech, about 14 MB an hour */
export const CAPTURE_BITRATE = 32_000;
/** No episode file grows past this (the upload limit is 20 MB) */
export const EPISODE_MAX_BYTES = 19_000_000;

const TAP_FILE = "voice-tap-worklet.js";

/** Whether this browser can make clips and episodes */
export function captureSupported(): boolean {
  const scope = globalThis as Record<string, unknown>;
  return (
    typeof scope.AudioEncoder === "function" &&
    typeof scope.AudioData === "function" &&
    typeof scope.AudioWorkletNode === "function" &&
    typeof scope.AudioContext === "function"
  );
}

/** A finished file and what is in it */
export type CaptureFile = {
  bytes: Uint8Array;
  seconds: number;
  /** Everyone whose voice is in it */
  voices: string[];
};

type Source = { track: MediaStreamTrack; node: MediaStreamAudioSourceNode };

export class CaptureEngine {
  #context?: AudioContext;
  #mix?: GainNode;
  #tap?: AudioWorkletNode;
  #encoder?: AudioEncoder;
  #sources = new Map<string, Source>();
  #ring: PacketRing;
  #buffering = false;
  #episode?: OpusPacket[];
  #episodeBytes = 0;
  #episodeVoices = new Set<string>();
  #timestamp = 0;
  #starting?: Promise<void>;
  #stopped = false;

  /** Called once when a running episode reached its size limit */
  onEpisodeFull?: () => void;

  constructor(clipSeconds: number) {
    this.#ring = new PacketRing(clipSeconds);
  }

  /** Open the audio graph and the encoder (once) */
  start(): Promise<void> {
    return (this.#starting ??= this.#start());
  }

  async #start() {
    const context = new AudioContext({ sampleRate: OPUS_RATE });
    this.#context = context;
    const base = import.meta.env?.BASE_URL ?? "/";
    await context.audioWorklet.addModule(`${base}${TAP_FILE}?v=1`);
    if (this.#stopped) return;

    const mix = context.createGain();
    const tap = new AudioWorkletNode(context, "zrzur-voice-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    });
    // the graph only runs what leads to the output: a silent way out
    const silent = context.createGain();
    silent.gain.value = 0;
    mix.connect(tap);
    tap.connect(silent);
    silent.connect(context.destination);

    const encoder = new AudioEncoder({
      output: (chunk) => this.#packet(chunk),
      error: (error) => console.warn("[capture] encoder", error),
    });
    encoder.configure({
      codec: "opus",
      sampleRate: OPUS_RATE,
      numberOfChannels: 1,
      bitrate: CAPTURE_BITRATE,
    });

    tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (this.#stopped || encoder.state !== "configured") return;
      // nothing to keep: no need to encode
      if (!this.#buffering && !this.#episode) return;
      const samples = event.data;
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: OPUS_RATE,
        numberOfFrames: samples.length,
        numberOfChannels: 1,
        timestamp: this.#timestamp,
        // the worklet transfers a plain ArrayBuffer, never a shared one
        data: samples as Float32Array<ArrayBuffer>,
      });
      this.#timestamp += (samples.length / OPUS_RATE) * 1_000_000;
      encoder.encode(data);
      data.close();
    };

    this.#mix = mix;
    this.#tap = tap;
    this.#encoder = encoder;
    if (context.state === "suspended") await context.resume().catch(() => {});
    // voices that were set while this was starting
    for (const [id, source] of this.#sources) this.#connect(id, source.track);
  }

  #packet(chunk: EncodedAudioChunk) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const samples = Math.round(((chunk.duration ?? 20_000) * OPUS_RATE) / 1e6);
    const packet = { data, samples };
    if (this.#buffering) this.#ring.push(packet);
    if (this.#episode) {
      this.#episode.push(packet);
      this.#episodeBytes += data.length + 2;
      if (this.#episodeBytes >= EPISODE_MAX_BYTES) {
        const full = this.onEpisodeFull;
        this.onEpisodeFull = undefined;
        full?.();
      }
    }
  }

  #connect(id: string, track: MediaStreamTrack) {
    const context = this.#context;
    const mix = this.#mix;
    if (!context || !mix) {
      this.#sources.set(id, { track, node: undefined as never });
      return;
    }
    const node = context.createMediaStreamSource(new MediaStream([track]));
    node.connect(mix);
    this.#sources.set(id, { track, node });
  }

  /**
   * The voices to hear from now on, by person. A voice that is taken out
   * also takes the seconds kept for clips with it.
   */
  setVoices(voices: Map<string, MediaStreamTrack>) {
    let removed = false;
    for (const [id, source] of [...this.#sources]) {
      const next = voices.get(id);
      if (next === source.track) continue;
      source.node?.disconnect();
      this.#sources.delete(id);
      // a new microphone of the same person is not a removal
      if (!next) removed = true;
    }
    if (removed) this.#ring.clear();
    for (const [id, track] of voices) {
      if (!this.#sources.has(id)) this.#connect(id, track);
      if (this.#episode) this.#episodeVoices.add(id);
    }
  }

  /** Keep the last seconds for clips, or stop and forget them */
  setBuffering(on: boolean) {
    if (this.#buffering === on) return;
    this.#buffering = on;
    if (!on) this.#ring.clear();
  }

  /** Seconds a clip made now would play */
  get bufferedSeconds() {
    return this.#ring.seconds;
  }

  /** The last seconds as a file (the store keeps rolling) */
  takeClip(): CaptureFile | undefined {
    const packets = this.#ring.take();
    const seconds = packetsSeconds(packets);
    if (seconds <= 0) return undefined;
    return {
      bytes: muxOggOpus(packets, { preSkip: CUT_PRE_SKIP }),
      seconds,
      voices: [...this.#sources.keys()].sort(),
    };
  }

  get recording() {
    return !!this.#episode;
  }

  /** Seconds recorded so far */
  get recordedSeconds() {
    return this.#episode ? packetsSeconds(this.#episode, 0) : 0;
  }

  startRecording() {
    if (this.#episode) return;
    this.#episode = [];
    this.#episodeBytes = 0;
    this.#episodeVoices = new Set(this.#sources.keys());
  }

  /** End the recording; with `keep` the episode comes back as a file */
  async endRecording(keep: boolean): Promise<CaptureFile | undefined> {
    const packets = this.#episode;
    if (!packets) return undefined;
    if (keep) await this.#encoder?.flush().catch(() => {});
    this.#episode = undefined;
    const voices = [...this.#episodeVoices].sort();
    this.#episodeVoices = new Set();
    if (!keep || !packets.length) return undefined;
    return {
      // the episode starts where the encoder started: only its own delay is skipped
      bytes: muxOggOpus(packets, { preSkip: 312 }),
      seconds: packetsSeconds(packets, 312),
      voices,
    };
  }

  /** Close everything and forget what was kept */
  stop() {
    this.#stopped = true;
    this.#ring.clear();
    this.#episode = undefined;
    for (const source of this.#sources.values()) source.node?.disconnect();
    this.#sources.clear();
    if (this.#tap) this.#tap.port.onmessage = null;
    this.#tap?.disconnect();
    this.#mix?.disconnect();
    if (this.#encoder && this.#encoder.state !== "closed") this.#encoder.close();
    void this.#context?.close().catch(() => {});
  }
}
