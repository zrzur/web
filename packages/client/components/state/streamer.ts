/**
 * Streamer mode: one switch that hides personal details on screen (email,
 * the own tag, invite links and codes, DM previews in notifications). Every
 * place reads the one setting `state.settings.streamerMode`; nothing is
 * recomputed for whole lists.
 */
import type { State } from ".";

/** What a hidden detail shows instead */
export const HIDDEN = "••••••••";

/** Whether the mode was turned on by a screen share (and goes off with it) */
let byShare = false;

/**
 * Turn streamer mode on or off by hand (the switch, the shortcut, the
 * indicator). A share that ends later leaves this choice alone.
 */
export function setStreamerMode(state: Pick<State, "settings">, on: boolean) {
  byShare = false;
  state.settings.streamerMode = on;
}

/**
 * Screen sharing started or stopped
 * @param sharing Whether the screen is shared now
 */
export function followScreenShare(
  state: Pick<State, "settings">,
  sharing: boolean,
) {
  if (sharing) {
    if (state.settings.streamerOnShare && !state.settings.streamerMode) {
      state.settings.streamerMode = true;
      byShare = true;
    }
  } else if (byShare) {
    byShare = false;
    state.settings.streamerMode = false;
  }
}

/** Whether a notification for this channel may show the message (DMs and groups hide it) */
export function notificationPreviewAllowed(
  streamerMode: boolean,
  channelType: string | undefined,
) {
  return (
    !streamerMode ||
    (channelType !== "DirectMessage" && channelType !== "Group")
  );
}
