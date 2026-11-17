/** The notice comes back at most once in this long while the old tag stays */
const AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;

/** Where this device remembers when it last told this account */
export const usernameNoticeKey = (userId: string) =>
  `zrzur:username-notice:${userId}`;

/**
 * Whether to tell now: never told on this device, or told long enough ago.
 * A device that refuses storage is told once per visit.
 */
export function usernameNoticeDue(
  userId: string,
  now: number,
  storage: Pick<Storage, "getItem"> | undefined,
): boolean {
  try {
    const last = Number(storage?.getItem(usernameNoticeKey(userId)) ?? 0);
    return !Number.isFinite(last) || now - last >= AGAIN_AFTER_MS;
  } catch {
    return true;
  }
}
