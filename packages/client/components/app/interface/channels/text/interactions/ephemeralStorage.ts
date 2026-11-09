import { decodeTime } from "ulid";

import type { EphemeralMessage } from "./types";

/** Private answers live as long as their interaction token */
export const EPHEMERAL_LIFETIME_MS = 15 * 60 * 1000;

/** Kept for this tab only, so a reload does not lose them; one key per account */
export const EPHEMERAL_STORAGE_PREFIX = "zrzur:ephemeral:";

/** Where one account's private answers are kept */
export const ephemeralKey = (userId: string) =>
  `${EPHEMERAL_STORAGE_PREFIX}${userId}`;

function storedKeys(storage: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(EPHEMERAL_STORAGE_PREFIX)) keys.push(key);
  }
  // the old single key, from before answers were kept per account
  if (storage.getItem("zrzur:ephemeral") !== null) keys.push("zrzur:ephemeral");
  return keys;
}

/**
 * The answers of this account that have not expired. Answers kept for any
 * other account (the tab changed accounts) are removed, never shown.
 */
export function takeStoredEphemeral(
  storage: Storage | undefined,
  userId: string,
  now: number,
): Record<string, EphemeralMessage[]> {
  if (!storage) return {};
  const mine = ephemeralKey(userId);
  try {
    for (const key of storedKeys(storage)) {
      if (key !== mine) storage.removeItem(key);
    }
    return readStoredEphemeral(storage.getItem(mine), now);
  } catch {
    return {};
  }
}

/** Log out: forget every account's answers in this tab */
export function forgetStoredEphemeral(storage: Storage | undefined) {
  if (!storage) return;
  try {
    for (const key of storedKeys(storage)) storage.removeItem(key);
  } catch {
    // blocked storage holds nothing to forget
  }
}

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
