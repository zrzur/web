/**
 * Streamer mode helpers (they live in stores/Settings.ts, in the state
 * chunk, so they add no request at start)
 */
export { followScreenShare, setStreamerMode } from "./stores/Settings";

/** What a hidden detail shows instead (screens that load later) */
export const HIDDEN = "••••••••";

/**
 * Run a screen share toggle with streamer mode on before the capture
 * starts, and off again when it failed or was cancelled
 */
export { shareWithStreamerMode } from "./streamerShare";
