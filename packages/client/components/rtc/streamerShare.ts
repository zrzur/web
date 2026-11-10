/**
 * Streamer mode around a screen share. A share only happens in a call, so
 * this comes with the voice runtime, not with the app.
 */
import { type Settings, BY_SHARE } from "../state/stores/Settings";

/**
 * A screen share starts (before the capture), or ended or the page
 * loaded. "Turned on by a share" is stored, so it never outlives the share.
 */
export function followScreenShare(
  state: { settings: Settings } | Settings,
  sharing: boolean,
) {
  const settings = "settings" in state ? state.settings : state;
  if (sharing) {
    if (
      settings.getValue("privacy:streamer_on_share") &&
      !settings.streamerMode
    ) {
      settings.streamerMode = true;
      settings.setValue(BY_SHARE, true);
    }
  } else if (settings.getValue(BY_SHARE)) settings.streamerMode = false;
}

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
