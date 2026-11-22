import { type Accessor, createSignal } from "solid-js";

/**
 * Playback of voice messages and audio files, kept outside the message rows.
 *
 * A row is drawn again whenever the list rebuilds its entry for the message
 * (the "New" line comes or goes, the message above it changes): when the
 * <audio> element lived in the row, that cleanup paused it part-way. Here
 * each file has one audio element, and a row that is drawn again picks up
 * the same element, still playing.
 *
 * How long a clip lives once no row shows it:
 * - playing: until it ends, also when scrolling took its row away;
 * - the reader left the conversation (another channel or page): stops at once;
 * - not playing: after RELEASE_GRACE_MS, unless a row shows it again.
 *
 * One rule for every player in the conversation: starting one pauses the
 * one that was playing (voice messages, audio files and videos alike).
 */

/** How long a paused clip that no row shows is kept */
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
  /** stop playing (the reader left the conversation) */
  pause(): void;
  seek(seconds: number): void;
  /**
   * The row that showed it is gone. `left`: the row shows another file now,
   * so the clip stops at once. `stillHere`: asked once the address has
   * settled (the router changes it after the old rows are gone); when the
   * reader has left the conversation, the clip stops then.
   */
  release(options?: { left?: boolean; stillHere?: () => boolean }): void;
}

interface Entry {
  src: string;
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

/**
 * Whether a failed `play()` means the file is broken. AbortError: paused or
 * reloaded before it started. NotAllowedError: the browser wants another
 * tap. Neither does.
 */
export function playFailed(failure: unknown) {
  const name = failure instanceof DOMException ? failure.name : "";
  return name !== "AbortError" && name !== "NotAllowedError";
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

/** How long after a row goes the address is read again */
export const ADDRESS_SETTLE_MS = 100;

/** Stop the clip, stop loading it and forget it */
function dispose(entry: Entry) {
  clearTimeout(entry.timer);
  entry.timer = undefined;
  if (clips.get(entry.src) === entry) clips.delete(entry.src);
  entry.audio.pause();
  endTurn(entry.audio);
  entry.audio.removeAttribute("src");
  entry.audio.load();
}

/** No row shows it: a paused clip goes after the grace, a playing one lives on */
function settle(entry: Entry) {
  if (entry.views || clips.get(entry.src) !== entry) return;
  clearTimeout(entry.timer);
  entry.timer = undefined;
  if (!entry.audio.paused) return;
  entry.timer = setTimeout(() => {
    if (!entry.views && entry.audio.paused) dispose(entry);
  }, RELEASE_GRACE_MS);
}

function create(src: string, preload: "none" | "metadata"): Entry {
  const audio = createAudio();
  audio.preload = preload;
  audio.src = src;

  const [playing, setPlaying] = createSignal(false);
  const [position, setPosition] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal(0);
  const [error, setError] = createSignal(false);

  const entry: Entry = {
    src,
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
          if (playFailed(failure)) setError(true);
        }
      },
      pause() {
        audio.pause();
      },
      seek(seconds) {
        audio.currentTime = Math.max(0, seconds);
        setPosition(audio.currentTime);
      },
      release(options) {
        entry.views = Math.max(0, entry.views - 1);
        if (entry.views) return;
        if (options?.left) return dispose(entry);
        settle(entry);
        const stillHere = options?.stillHere;
        if (stillHere)
          setTimeout(() => {
            if (!entry.views && clips.get(src) === entry && !stillHere())
              dispose(entry);
          }, ADDRESS_SETTLE_MS);
      },
    },
  };

  audio.addEventListener("play", () => {
    setError(false);
    takeTurn(audio);
    setPlaying(true);
  });
  audio.addEventListener("pause", () => {
    setPlaying(false);
    settle(entry);
  });
  audio.addEventListener("ended", () => {
    setPlaying(false);
    setPosition(0);
    settle(entry);
  });
  audio.addEventListener("timeupdate", () => setPosition(audio.currentTime));
  const duration = () => setMediaDuration(finite(audio.duration));
  audio.addEventListener("loadedmetadata", duration);
  audio.addEventListener("durationchange", duration);
  audio.addEventListener("error", () => {
    // a source taken away on purpose (dispose) is not a failure
    if (!audio.getAttribute("src")) return;
    setError(true);
    setPlaying(false);
  });

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

/**
 * Whether the reader is still in the conversation the row belonged to: the
 * address still names its channel. Rows a scroll trimmed away stay in it;
 * a switch to another channel or page does not.
 */
export function stillIn(channelId: string | undefined, path: string) {
  return !channelId || path.split("/").includes(channelId);
}
