import type { ConnectionState, Track } from "livekit-client";

// livekit-client loads with the first call, not with the app. These are the
// few of its values the app needs before that (livekitConstants.test.ts
// checks them against the library).

/** Track.Source */
export const TrackSource = {
  Camera: "camera",
  Microphone: "microphone",
  ScreenShare: "screen_share",
  ScreenShareAudio: "screen_share_audio",
  Unknown: "unknown",
} as unknown as typeof Track.Source;

/** Track.Kind */
export const TrackKind = {
  Audio: "audio",
  Video: "video",
  Unknown: "unknown",
} as unknown as typeof Track.Kind;

/** ConnectionState */
export const RoomState = {
  Disconnected: "disconnected",
  Connecting: "connecting",
  Connected: "connected",
  Reconnecting: "reconnecting",
  SignalReconnecting: "signalReconnecting",
} as unknown as typeof ConnectionState;
