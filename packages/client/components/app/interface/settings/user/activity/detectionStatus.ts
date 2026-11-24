/**
 * Where activity is detected, for the status row of Settings → Activity.
 * Kept pure for unit tests.
 *
 * - `browser`: a browser cannot see running programs; the desktop app can.
 * - `update`: a desktop app from before rich presence (26.2.0 and older) has
 *   no `window.native.activity`, so it detects nothing until updated.
 * - `off`: the desktop app can detect, but sharing is off, so it does not.
 * - `live`: the desktop app is detecting now.
 */
export type DetectionStatus = "browser" | "update" | "off" | "live";

export function detectionStatus(where: {
  /** Running inside the desktop app (`window.native`) */
  native: boolean;
  /** The desktop app has the activity bridge (`window.native.activity`) */
  bridge: boolean;
  /** The person shares their activity */
  sharing: boolean;
}): DetectionStatus {
  if (!where.native) return "browser";
  if (!where.bridge) return "update";
  return where.sharing ? "live" : "off";
}

type Reported<A> = { rpc?: A | null; desktop?: A | null } | undefined;

/**
 * What the desktop app detects right now: an app's own report first (it
 * knows most), then the program it saw running. Nothing without a name.
 */
export function detectedNow<A extends { name: string }>(
  update: Reported<A>,
): A | undefined {
  for (const activity of [update?.rpc, update?.desktop])
    if (activity && activity.name.trim()) return activity;
  return undefined;
}
