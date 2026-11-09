/**
 * Call stability helpers, free of LiveKit and Solid so they can be tested
 * on their own: connection quality per participant and falling back when
 * a microphone or speaker is unplugged.
 */

/** LiveKit's ConnectionQuality values */
export type ConnectionQualityName =
  | "excellent"
  | "good"
  | "poor"
  | "lost"
  | "unknown";

/**
 * Bars to draw for a participant, and whether to point it out (a weak or
 * lost connection explains choppy sound before anyone asks)
 */
export function qualityLevel(quality: ConnectionQualityName | undefined): {
  bars: 0 | 1 | 2 | 3;
  warn: boolean;
} {
  switch (quality) {
    case "good":
      return { bars: 2, warn: false };
    case "poor":
      return { bars: 1, warn: true };
    case "lost":
      return { bars: 0, warn: true };
    default:
      return { bars: 3, warn: false };
  }
}

/**
 * What to do after the devices changed (one kind: input or output).
 * Unplugged: use the system default and say so. Plugged in again: go back
 * to it, since the saved choice is kept on purpose.
 */
export function deviceFallback(options: {
  /** Saved choice (undefined: the system default) */
  preferred: string | undefined;
  /** Device the call uses now */
  active: string | undefined;
  available: { deviceId: string }[];
}): { switchTo?: string; notice?: "fallback" | "restored" } {
  const { preferred, active, available } = options;
  if (!preferred || preferred === "default") return {};
  const present = (id: string | undefined) =>
    !!id && available.some((device) => device.deviceId === id);
  if (present(preferred)) {
    return active === preferred
      ? {}
      : { switchTo: preferred, notice: "restored" };
  }
  if (active !== preferred) return {};
  if (!available.length) return { notice: "fallback" };
  return {
    switchTo: present("default") ? "default" : available[0].deviceId,
    notice: "fallback",
  };
}
