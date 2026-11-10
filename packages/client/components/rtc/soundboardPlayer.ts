/**
 * Soundboard playback. Each sound is fetched and decoded once, then the
 * decoded AudioBuffer is played again from memory: a sound that plays ten
 * times costs one download and one decode. Nothing here goes through the
 * call: every listener plays the sound on their own device, at their own
 * volume, or not at all.
 */

/** Longest a sound plays (the server refuses longer ones too) */
export const SOUND_MAX_MS = 5_200;

/** Sounds kept decoded at once (a server has at most 32) */
const MAX_BUFFERS = 48;

/** Sounds that may overlap; the oldest stops for a new one */
const MAX_PLAYING = 3;

/** Address of a sound's file */
export function soundUrl(mediaUrl: string, soundId: string) {
  return `${mediaUrl}/sounds/${soundId}/original`;
}

/** The gain a sound plays at: its own volume times the listener's */
export function soundGain(soundVolume: number, listenerVolume: number) {
  const own = Math.min(100, Math.max(0, soundVolume)) / 100;
  return own * Math.min(1, Math.max(0, listenerVolume));
}

type Fetcher = (url: string) => Promise<ArrayBuffer>;

const fetchBytes: Fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`sound ${response.status}`);
  return response.arrayBuffer();
};

export class SoundboardPlayer {
  #context?: AudioContext;
  #buffers = new Map<string, Promise<AudioBuffer>>();
  #playing: AudioBufferSourceNode[] = [];
  #fetch: Fetcher;
  #createContext: () => AudioContext;

  constructor(
    fetcher: Fetcher = fetchBytes,
    createContext: () => AudioContext = () => new AudioContext(),
  ) {
    this.#fetch = fetcher;
    this.#createContext = createContext;
  }

  get context() {
    return (this.#context ??= this.#createContext());
  }

  /** Number of decoded (or decoding) sounds kept */
  get cached() {
    return this.#buffers.size;
  }

  /**
   * The decoded sound, from memory after the first time
   * @param id Sound id
   * @param url File address
   */
  load(id: string, url: string): Promise<AudioBuffer> {
    const known = this.#buffers.get(id);
    if (known) {
      // most recently used goes last
      this.#buffers.delete(id);
      this.#buffers.set(id, known);
      return known;
    }

    const loading = this.#fetch(url).then((bytes) =>
      this.context.decodeAudioData(bytes),
    );
    // a failed download may be tried again
    loading.catch(() => {
      if (this.#buffers.get(id) === loading) this.#buffers.delete(id);
    });
    this.#buffers.set(id, loading);
    while (this.#buffers.size > MAX_BUFFERS) {
      const oldest = this.#buffers.keys().next().value as string;
      this.#buffers.delete(oldest);
    }
    return loading;
  }

  /** Forget a removed sound */
  forget(id: string) {
    this.#buffers.delete(id);
  }

  /**
   * Play a sound
   * @param id Sound id
   * @param url File address
   * @param gain 0-1
   */
  async play(id: string, url: string, gain: number): Promise<void> {
    if (gain <= 0) return;
    const buffer = await this.load(id, url);
    const context = this.context;
    if (context.state === "suspended") await context.resume().catch(() => {});

    const source = context.createBufferSource();
    source.buffer = buffer;
    const volume = context.createGain();
    volume.gain.value = gain;
    source.connect(volume).connect(context.destination);

    this.#playing.push(source);
    while (this.#playing.length > MAX_PLAYING) {
      this.#stop(this.#playing.shift()!);
    }
    source.onended = () => {
      this.#playing = this.#playing.filter((playing) => playing !== source);
      source.disconnect();
    };
    source.start(0, 0, Math.min(buffer.duration, SOUND_MAX_MS / 1000));
  }

  #stop(source: AudioBufferSourceNode) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }

  /** Stop whatever plays (leaving a call, deafen, muting the soundboard) */
  stopAll() {
    for (const source of this.#playing) this.#stop(source);
    this.#playing = [];
  }
}
