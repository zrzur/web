/**
 * Voice on a weak connection: when a call counts as weak, and what the app
 * does then. Free of LiveKit and Solid so it can be tested on its own.
 *
 * A call has three levels. It moves one level at a time, down quickly and
 * back up slowly, so a short dip does not make the picture flicker:
 *
 * - good: nothing changes.
 * - weak: a sign is shown; the microphone sends lighter voice, video is
 *   received and sent at its lowest quality.
 * - bad: video is paused both ways and only audio is kept, lighter still.
 *
 * Audio already carries what protects it on a lossy network (Opus with
 * in-band error correction, DTX, and RED: see audioQuality.ts); these steps
 * free the bandwidth it needs.
 *
 * Low-data mode's lighter voice uses `lightVoiceBitrate` so the two never
 * disagree about what "lighter" is.
 */
import type { ConnectionQualityName } from "./callHealth";

export type NetworkLevel = "good" | "weak" | "bad";

/** The numbers, as the server sends them in `features.voice_weak_network` */
export type WeakNetworkSettings = {
  weak_loss_percent: number;
  bad_loss_percent: number;
  weak_rtt_ms: number;
  bad_rtt_ms: number;
  weak_audio_bitrate: number;
  bad_audio_bitrate: number;
  recover_seconds: number;
};

/** Used until the server sends its own (the same numbers as its defaults) */
export const DEFAULT_WEAK_NETWORK: WeakNetworkSettings = {
  weak_loss_percent: 5,
  bad_loss_percent: 15,
  weak_rtt_ms: 400,
  bad_rtt_ms: 800,
  weak_audio_bitrate: 24_000,
  bad_audio_bitrate: 16_000,
  recover_seconds: 10,
};

/** Samples in a row that have to be worse before a call steps down */
export const SAMPLES_TO_STEP_DOWN = 2;

/** Voice kept clear for music even on a very weak connection */
const MUSIC_FLOOR = 48_000;

/** The server's numbers where they make sense, the defaults elsewhere */
export function weakNetworkSettings(
  from: Partial<WeakNetworkSettings> | undefined,
): WeakNetworkSettings {
  const settings = { ...DEFAULT_WEAK_NETWORK };
  if (!from) return settings;
  for (const key of Object.keys(settings) as (keyof WeakNetworkSettings)[]) {
    const value = from[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0)
      settings[key] = value;
  }
  // "bad" is never easier to reach than "weak"
  settings.bad_loss_percent = Math.max(
    settings.bad_loss_percent,
    settings.weak_loss_percent,
  );
  settings.bad_rtt_ms = Math.max(settings.bad_rtt_ms, settings.weak_rtt_ms);
  settings.bad_audio_bitrate = Math.min(
    settings.bad_audio_bitrate,
    settings.weak_audio_bitrate,
  );
  return settings;
}

/** The bitrate of "lighter voice" (low-data mode uses it too) */
export function lightVoiceBitrate(
  settings: Pick<
    WeakNetworkSettings,
    "weak_audio_bitrate"
  > = DEFAULT_WEAK_NETWORK,
) {
  return settings.weak_audio_bitrate;
}

/** One look at the connection */
export type NetworkSample = {
  /** When it was taken (ms) */
  at: number;
  /** Packets lost since the last look, in percent (worst direction) */
  lossPercent?: number;
  /** Round trip time in ms */
  rttMs?: number;
  /** What the voice server says about this connection */
  /** What the voice server says, kept for diagnosis only (never counted) */
  quality?: ConnectionQualityName;
};

const ORDER: NetworkLevel[] = ["good", "weak", "bad"];

function worse(a: NetworkLevel, b: NetworkLevel): NetworkLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/** What one sample alone says about the connection */
export function rateSample(
  sample: NetworkSample,
  settings: WeakNetworkSettings,
): NetworkLevel {
  let level: NetworkLevel = "good";
  if (sample.lossPercent !== undefined) {
    if (sample.lossPercent >= settings.bad_loss_percent) level = "bad";
    else if (sample.lossPercent >= settings.weak_loss_percent) level = "weak";
  }
  if (sample.rttMs !== undefined) {
    if (sample.rttMs >= settings.bad_rtt_ms) level = worse(level, "bad");
    else if (sample.rttMs >= settings.weak_rtt_ms) level = worse(level, "weak");
  }
  // the voice server's verdict (sample.quality) does not count: it reacts
  // to the steps themselves and to a fresh join, and kept clean calls down
  return level;
}

/** Where a call stands between samples */
export type NetworkState = {
  level: NetworkLevel;
  /** Samples in a row that were worse than the level */
  worseCount: number;
  /** Since when every sample has been better than the level (ms) */
  betterSince?: number;
};

export const GOOD_NETWORK: NetworkState = { level: "good", worseCount: 0 };

/**
 * The state after one more sample. Down one level after
 * `SAMPLES_TO_STEP_DOWN` worse samples in a row; up one level after
 * `recover_seconds` in which every sample was better.
 */
export function nextNetworkState(
  state: NetworkState,
  sample: NetworkSample,
  settings: WeakNetworkSettings,
): NetworkState {
  const rated = ORDER.indexOf(rateSample(sample, settings));
  const current = ORDER.indexOf(state.level);

  if (rated > current) {
    const worseCount = state.worseCount + 1;
    if (worseCount >= SAMPLES_TO_STEP_DOWN)
      return { level: ORDER[current + 1], worseCount: 0 };
    return { level: state.level, worseCount };
  }

  if (rated < current) {
    const betterSince = state.betterSince ?? sample.at;
    if (sample.at - betterSince >= settings.recover_seconds * 1000)
      return { level: ORDER[current - 1], worseCount: 0 };
    return { level: state.level, worseCount: 0, betterSince };
  }

  return { level: state.level, worseCount: 0 };
}

/** What the app does at a level */
export type NetworkPlan = {
  /** Show the "weak connection" sign */
  sign: boolean;
  /** Bitrate the microphone sends at */
  audioBitrate: number;
  /** Video of others: as shown, lowest quality, or not received */
  remoteVideo: "auto" | "low" | "off";
  /** Own camera and screen: as set, lowest quality, or not sent */
  ownVideo: "full" | "low" | "paused";
};

/**
 * @param base Bitrate the call would send at on a good connection
 * @param music High quality audio is on (kept clearer: it is the content)
 */
export function planFor(
  level: NetworkLevel,
  base: number,
  music: boolean,
  settings: WeakNetworkSettings,
): NetworkPlan {
  switch (level) {
    case "weak":
      return {
        sign: true,
        audioBitrate: music
          ? base
          : Math.min(base, settings.weak_audio_bitrate),
        remoteVideo: "low",
        ownVideo: "low",
      };
    case "bad":
      return {
        sign: true,
        audioBitrate: Math.min(
          base,
          music ? MUSIC_FLOOR : settings.bad_audio_bitrate,
        ),
        remoteVideo: "off",
        ownVideo: "paused",
      };
    default:
      return {
        sign: false,
        audioBitrate: base,
        remoteVideo: "auto",
        ownVideo: "full",
      };
  }
}

/** Packet counters of one direction, as WebRTC reports them (they only grow) */
export type PacketCounters = { lost: number; received: number };

/**
 * Loss in percent between two readings; undefined when nothing arrived (a
 * silent call with DTX sends almost nothing, which is not loss)
 */
export function lossBetween(
  before: PacketCounters | undefined,
  now: PacketCounters,
): number | undefined {
  if (!before) return undefined;
  const lost = Math.max(0, now.lost - before.lost);
  const received = Math.max(0, now.received - before.received);
  const total = lost + received;
  if (total < 5) return undefined;
  return (lost / total) * 100;
}
