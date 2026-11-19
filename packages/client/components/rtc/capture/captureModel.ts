/**
 * Clips and recorded rooms: the decisions, free of the browser and of
 * LiveKit so they are tested on their own.
 *
 * The rule everything here serves: a voice is put into a clip or an episode
 * only while its owner is in `included`, the list the server keeps from each
 * person's own choice.
 */

/** A recording that runs in a room */
export type RecordingLive = {
  by: string;
  started_at: number;
  title?: string | null;
};

/** What the server says about a room (`VoiceCaptureUpdate`) */
export type CaptureState = {
  /** Who turned clips on; unset while they are off */
  clips?: string | null;
  recording?: RecordingLive | null;
  /** People in the room whose voice may be saved */
  included: string[];
};

/** What is left of the month */
export type CaptureAllowance = {
  clip_seconds: number;
  clips_left: number;
  clips_per_month: number;
  recording_seconds_left: number;
  recording_seconds_per_month: number;
  episode_max_seconds: number;
  opt_in: boolean;
};

/** A saved clip or episode */
export type CaptureItem = {
  _id: string;
  kind: "Clip" | "Episode";
  channel: string;
  server: string;
  author: string;
  file: string;
  shared_in: string;
  message: string;
  duration: number;
  included: string[];
  title?: string | null;
};

export const NO_CAPTURE: CaptureState = { included: [] };

/** Tidy what came over the wire */
export function captureState(from: unknown): CaptureState {
  const value = (from ?? {}) as Partial<CaptureState>;
  return {
    clips: typeof value.clips === "string" ? value.clips : undefined,
    recording:
      value.recording && typeof value.recording.by === "string"
        ? value.recording
        : undefined,
    included: Array.isArray(value.included)
      ? value.included.filter((id) => typeof id === "string")
      : [],
  };
}

/** Clips are on or a recording runs */
export function captureActive(state: CaptureState) {
  return !!state.clips || !!state.recording;
}

/**
 * Whose voices this device may put into what it saves: the people who are
 * included and are in the call right now. Nobody else, whatever the caller
 * passes as present.
 */
export function voicesToMix(state: CaptureState, present: string[]): string[] {
  if (!captureActive(state)) return [];
  const allowed = new Set(state.included);
  return [...new Set(present)].filter((id) => allowed.has(id)).sort();
}

/** What this device should be doing for the room */
export type EngineJob = {
  /** Keep the last seconds ready for a clip */
  buffer: boolean;
  /** Record the episode (only the person who started it does) */
  record: boolean;
};

export function engineJob(state: CaptureState, me: string): EngineJob {
  return {
    buffer: !!state.clips,
    record: !!state.recording && state.recording.by === me,
  };
}

/**
 * Whether to ask this person for their choice: something is on, and they
 * have not answered since it came on (an answer holds until they leave)
 */
export function shouldAsk(state: CaptureState, answered: boolean) {
  return captureActive(state) && !answered;
}

/** Why a clip cannot be saved right now, or undefined when it can */
export type ClipBlock = "off" | "limit" | "empty" | "busy";

export function clipBlock(options: {
  state: CaptureState;
  allowance?: CaptureAllowance;
  bufferedSeconds: number;
  saving: boolean;
}): ClipBlock | undefined {
  if (!options.state.clips) return "off";
  if (options.saving) return "busy";
  if (options.allowance && options.allowance.clips_left <= 0) return "limit";
  // under a second there is nothing worth sharing yet
  if (options.bufferedSeconds < 1) return "empty";
  return undefined;
}

/**
 * Seconds a running recording may still go on: the shortest of the longest
 * episode and what the month has left, minus what already ran
 */
export function recordingSecondsLeft(
  recording: RecordingLive,
  allowance: Pick<
    CaptureAllowance,
    "episode_max_seconds" | "recording_seconds_left"
  >,
  nowMs: number,
) {
  const ran = Math.max(0, (nowMs - recording.started_at) / 1000);
  const longest = Math.min(
    allowance.episode_max_seconds,
    allowance.recording_seconds_left,
  );
  return Math.max(0, longest - ran);
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  const two = (value: number) => String(value).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** A file name that says what it is and sorts by time */
export function captureFileName(kind: "clip" | "episode", at: Date) {
  const two = (value: number) => String(value).padStart(2, "0");
  const stamp = `${at.getUTCFullYear()}${two(at.getUTCMonth() + 1)}${two(at.getUTCDate())}-${two(at.getUTCHours())}${two(at.getUTCMinutes())}${two(at.getUTCSeconds())}`;
  return `${kind}-${stamp}.ogg`;
}

/** Who may delete an item: its author and everyone whose voice is in it */
export function mayDelete(item: CaptureItem, me: string, moderator: boolean) {
  return moderator || item.author === me || item.included.includes(me);
}
