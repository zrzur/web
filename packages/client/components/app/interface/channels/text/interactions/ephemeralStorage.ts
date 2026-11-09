import { decodeTime } from "ulid";

import type { EphemeralMessage } from "./types";

/** Private answers live as long as their interaction token */
export const EPHEMERAL_LIFETIME_MS = 15 * 60 * 1000;

/** Kept for this tab only, so a reload does not lose them */
export const EPHEMERAL_STORAGE_KEY = "zrzur:ephemeral";

/** When a private answer expires (ms), or undefined for a bad id */
export function ephemeralExpiry(message: { _id: string }) {
  try {
    return decodeTime(message._id) + EPHEMERAL_LIFETIME_MS;
  } catch {
    return undefined;
  }
}

/** The stored private answers that have not expired yet, per channel */
export function readStoredEphemeral(
  raw: string | null,
  now: number,
): Record<string, EphemeralMessage[]> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const kept: Record<string, EphemeralMessage[]> = {};
  for (const [channel, list] of Object.entries(parsed)) {
    if (!Array.isArray(list)) continue;
    const alive = list.filter((message): message is EphemeralMessage => {
      if (!message || typeof message._id !== "string") return false;
      const expiry = ephemeralExpiry(message);
      return expiry !== undefined && expiry > now;
    });
    if (alive.length) kept[channel] = alive;
  }
  return kept;
}

/** Session storage when there is one (not in tests or private modes) */
export function ephemeralStorage(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}
