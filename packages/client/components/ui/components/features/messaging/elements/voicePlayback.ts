import { type Accessor, createSignal } from "solid-js";

/**
 * Playback of voice messages and audio files, kept outside the message rows.
 *
 * A row is drawn again whenever the list rebuilds its entry for the message
 * (the "new messages" line comes or goes, the message above it changes):
 * when the <audio> element lived in the row, that cleanup paused it part-way.
 * Here each file has one audio element for as long as any row shows it, and
 * a row that is drawn again picks up the same element, still playing.
 *
 * One rule for every player in the conversation: starting one pauses the
 * one that was playing (voice messages, audio files and videos alike).
 */

/** How long a clip no row shows keeps playing before it stops */
export const RELEASE_GRACE_MS = 1500;

export interface VoiceClip {
  playing: Accessor<boolean>;
  /** position in seconds */
  current: Accessor<number>;
  /** what the media element reports (0 while unknown) */
  mediaDuration: Accessor<number>;
  /** the file could not be loaded or played */
  error: Accessor<boolean>;
  toggle(): Promise<void>;
  seek(seconds: number): void;
  /** the row that showed it is gone */
  release(): void;
}

interface Entry {
  audio: HTMLAudioElement;
  views: number;
  timer?: ReturnType<typeof setTimeout>;
  clip: VoiceClip;
}

const clips = new Map<string, Entry>();

/** The media element that plays now, if any */
let current: HTMLMediaElement | undefined;

/**
 * A player starts: the one that played before pauses. Videos call this too.
 */
export function takeTurn(media: HTMLMediaElement) {
  if (current && current !== media && !current.paused) current.pause();
  current = media;
}

/** A player stopped for good (its row left): forget it */
export function endTurn(media: HTMLMediaElement) {
  if (current === media) current = undefined;
}

/** Creates the audio element; tests swap it */
let createAudio = () => document.createElement("audio");

/** For tests: use another audio element factory, and start afresh */
export function resetVoicePlayback(factory?: () => HTMLAudioElement) {
  for (const entry of clips.values()) {
    clearTimeout(entry.timer);
    entry.audio.pause();
  }
  clips.clear();
  current = undefined;
  createAudio = factory ?? (() => document.createElement("audio"));
}

/** Number of files with a live audio element (tests) */
export function liveClips() {
  return clips.size;
}

function finite(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function create(src: string, preload: "none" | "metadata"): Entry {
  const audio = createAudio();
  audio.preload = preload;
  audio.src = src;

  const [playing, setPlaying] = createSignal(false);
  const [position, setPosition] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal(0);
  const [error, setError] = createSignal(false);

  audio.addEventListener("play", () => {
    setError(false);
    takeTurn(audio);
    setPlaying(true);
  });
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => {
    setPlaying(false);
    setPosition(0);
  });
  audio.addEventListener("timeupdate", () => setPosition(audio.currentTime));
  const duration = () => setMediaDuration(finite(audio.duration));
  audio.addEventListener("loadedmetadata", duration);
  audio.addEventListener("durationchange", duration);
  audio.addEventListener("error", () => {
    setError(true);
    setPlaying(false);
  });

  const entry: Entry = {
    audio,
    views: 0,
    clip: {
      playing,
      current: position,
      mediaDuration,
      error,
      async toggle() {
        if (!audio.paused) return audio.pause();
        // a failed load (a dropped connection) is tried again on the next tap
        if (error()) {
          setError(false);
          audio.load();
        }
        takeTurn(audio);
        try {
          await audio.play();
        } catch (failure) {
          // AbortError: paused or reloaded before it started. NotAllowedError:
          // the browser wants another tap. Neither means the file is broken.
          const name = failure instanceof DOMException ? failure.name : "";
          if (name !== "AbortError" && name !== "NotAllowedError")
            setError(true);
        }
      },
      seek(seconds) {
        audio.currentTime = Math.max(0, seconds);
        setPosition(audio.currentTime);
      },
      release() {
        entry.views = Math.max(0, entry.views - 1);
        if (entry.views) return;
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
          if (entry.views || clips.get(src) !== entry) return;
          clips.delete(src);
          audio.pause();
          endTurn(audio);
          // stop loading it
          audio.removeAttribute("src");
          audio.load();
        }, RELEASE_GRACE_MS);
      },
    },
  };
  return entry;
}

/**
 * The player for a file, shared by every row that shows it. Call `release`
 * when the row goes (onCleanup).
 */
export function voiceClip(
  src: string,
  preload: "none" | "metadata" = "metadata",
): VoiceClip {
  let entry = clips.get(src);
  if (!entry) {
    entry = create(src, preload);
    clips.set(src, entry);
  } else if (preload === "metadata" && entry.audio.preload === "none") {
    entry.audio.preload = preload;
  }
  clearTimeout(entry.timer);
  entry.timer = undefined;
  entry.views++;
  return entry.clip;
}
