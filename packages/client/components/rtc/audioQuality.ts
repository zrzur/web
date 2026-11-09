import type { AudioCaptureOptions, TrackPublishDefaults } from "livekit-client";

import type { NoiseSuppresionState } from "@revolt/state/stores/Voice";

/**
 * How the microphone is captured and published.
 *
 * Voice (default): Opus mono at the server's voice bitrate (64 kbps base,
 * more with Wings), DTX on (silence costs almost nothing, and the input gate
 * sends silence), RED on (each packet carries the previous one, so a lost
 * packet is rebuilt instead of heard as a click). Priority high, so audio
 * keeps its bandwidth when a screen share competes for it. Noise
 * suppression changes only what is captured, never the bitrate.
 *
 * High quality audio (music, instruments): 128 kbps stereo or the server's
 * higher rate, every voice treatment off (echo cancellation, noise
 * suppression, gain control and the input gate all damage music), DTX off
 * (it cuts quiet passages), RED kept for packet loss.
 */

/** Opus bitrate of high quality audio (LiveKit's musicHighQualityStereo) */
export const MUSIC_BITRATE = 128_000;

/** Bitrate a call sends at: the server's voice rate, raised for music */
export function callBitrate(voiceBitrate: number, music: boolean) {
  return music ? Math.max(voiceBitrate, MUSIC_BITRATE) : voiceBitrate;
}

/** Publish defaults for the microphone */
export function audioPublishFor(
  voiceBitrate: number,
  music: boolean,
): Pick<TrackPublishDefaults, "audioPreset" | "dtx" | "red" | "forceStereo"> {
  return {
    audioPreset: {
      maxBitrate: callBitrate(voiceBitrate, music),
      priority: "high",
    },
    dtx: !music,
    red: true,
    forceStereo: music,
  };
}

/** Capture options for the microphone */
export function audioCaptureFor(
  settings: {
    preferredAudioInputDevice?: string;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
    noiseSupression?: NoiseSuppresionState;
  },
  music: boolean,
): AudioCaptureOptions {
  const browserSuppression = settings.noiseSupression === "browser";
  return {
    deviceId: settings.preferredAudioInputDevice,
    echoCancellation: music ? false : (settings.echoCancellation ?? true),
    noiseSuppression: music ? false : browserSuppression,
    voiceIsolation: music ? false : browserSuppression,
    autoGainControl: music ? false : (settings.autoGainControl ?? true),
    channelCount: music ? 2 : 1,
  };
}
