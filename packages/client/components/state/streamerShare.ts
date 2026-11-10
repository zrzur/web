import { type Settings, followScreenShare } from "./stores/Settings";

/**
 * Run a screen share toggle with streamer mode on before the capture
 * starts, and off again when it failed or was cancelled
 */
export async function shareWithStreamerMode(
  state: { settings: Settings },
  wasSharing: boolean,
  toggle: () => Promise<void>,
  sharing: () => boolean,
) {
  if (!wasSharing) followScreenShare(state, true);
  try {
    await toggle();
  } finally {
    if (!sharing()) followScreenShare(state, false);
  }
}
