/**
 * Phones: fetch, while nothing else is happening, the code of the screens a
 * tap opens, so the first tap does not wait for a download.
 *
 * Measured on a slow phone profile (1.6 Mbps, 150 ms; owner, 2026-11-18:
 * "things take long to open"): the settings waited 3.5 s for their code
 * (564 KB, plus 229 KB of badge art) the first time, the channel details up
 * to 5 s behind other downloads, "You" and the notifications about 0.4 s.
 * Opened again they take a fraction of that. These screens stay out of the
 * files the app installs up front (scripts/precacheShell.mjs keeps the
 * install small); this brings them a few seconds after the app is on
 * screen, one after the other, and the service worker keeps them.
 *
 * Not on a metered or very slow connection: there a person pays for what
 * they may never open.
 */

type Connection = { saveData?: boolean; effectiveType?: string };

/** May this device fetch ahead? */
export function mayWarm(connection: Connection | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType ?? "");
}

/** the screens, the smallest first */
const screens: (() => Promise<unknown>)[] = [
  () => import("./channels/text/ComposerAddPanel"),
  () => import("./navigation/NotificationsPhone"),
  () => import("./You"),
  () => import("./channels/text/ChannelDetailsPhone"),
  () => import("@revolt/modal/modals/Settings"),
];

let started = false;

/**
 * Start fetching the phone's screens once the app has been idle for a
 * moment. Safe to call more than once.
 * @param delay Milliseconds to wait before the first one
 */
export function warmPhoneScreens(delay = 4000) {
  if (started) return;
  started = true;
  if (
    !mayWarm((navigator as Navigator & { connection?: Connection }).connection)
  )
    return;

  const idle: (run: () => void) => void =
    "requestIdleCallback" in window
      ? (run) => window.requestIdleCallback(run, { timeout: 3000 })
      : (run) => window.setTimeout(run, 300);

  let at = 0;
  const next = () => {
    const load = screens[at++];
    if (!load) return;
    // a failed download is no fault here: the tap will ask again
    idle(() => void load().then(next, next));
  };
  window.setTimeout(next, delay);
}
