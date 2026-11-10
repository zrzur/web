import type { API } from "@zrzur/sdk/solid";

export function statusRetryDelay(error: unknown): number | undefined {
  let data = error;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  if (!data || typeof data !== "object") return undefined;
  const value = (data as { retry_after?: unknown }).retry_after;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(60_000, Math.max(100, value + 100))
    : undefined;
}

/**
 * The status as one line for `TextWithEmoji`: the emoji first (a custom
 * emoji as its `:id:` code), then the text
 */
export function statusLine(
  emoji?: string | null,
  text?: string | null,
): string | undefined {
  const mark = emoji
    ? /^[0-9A-HJKMNP-TV-Z]{26}$/.test(emoji)
      ? `:${emoji}:`
      : emoji
    : undefined;
  const line = [mark, text?.trim() || undefined].filter(Boolean).join(" ");
  return line || undefined;
}

/** When a custom status clears itself */
export type StatusExpiry = "never" | "30m" | "1h" | "4h" | "today";

export const STATUS_EXPIRIES: StatusExpiry[] = [
  "never",
  "30m",
  "1h",
  "4h",
  "today",
];

const MINUTE = 60_000;

/**
 * The time a status set now with this choice runs out ("today" is the next
 * local midnight, at least a minute away)
 */
export function statusExpiresAt(
  expiry: StatusExpiry,
  now = new Date(),
): string | undefined {
  const at = (minutes: number) =>
    new Date(now.getTime() + minutes * MINUTE).toISOString();
  switch (expiry) {
    case "30m":
      return at(30);
    case "1h":
      return at(60);
    case "4h":
      return at(240);
    case "today": {
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return new Date(
        Math.max(midnight.getTime(), now.getTime() + MINUTE),
      ).toISOString();
    }
    default:
      return undefined;
  }
}

/**
 * The edit that sets a custom status. Text, emoji and expiry go together:
 * an emoji alone replaces the old text, and nothing at all clears it.
 */
export function customStatusPatch(
  text: string,
  options: {
    emoji?: string;
    expiry?: StatusExpiry;
    /** Keep this expiry (the one already set) instead of a new choice */
    keepExpiresAt?: string;
    now?: Date;
  } = {},
): API.DataEditUser {
  const value = text.trim();
  const emoji = options.emoji || undefined;
  if (!value && !emoji) return { remove: ["StatusText"] };

  const status: NonNullable<API.DataEditUser["status"]> = {};
  if (value) status.text = value;
  if (emoji) status.emoji = emoji;
  const kept =
    options.keepExpiresAt &&
    Date.parse(options.keepExpiresAt) > (options.now ?? new Date()).getTime()
      ? options.keepExpiresAt
      : undefined;
  const expiresAt =
    kept ?? statusExpiresAt(options.expiry ?? "never", options.now);
  if (expiresAt) status.expires_at = expiresAt;

  return value ? { status } : { status, remove: ["StatusText"] };
}

/**
 * Retry only explicit rate-limit responses, with cancellation and a cap
 * (2 retries; a long multi-step setup such as a server template may allow
 * more, since the server says how long to wait).
 */
export async function writeStatusWithRetry(
  write: () => Promise<unknown>,
  options: {
    signal: AbortSignal;
    retrying?: (retrying: boolean) => void;
    retries?: number;
  },
) {
  const retries = options.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    options.signal.throwIfAborted();
    try {
      await write();
      return;
    } catch (error) {
      const delay = statusRetryDelay(error);
      if (delay === undefined || attempt >= retries) throw error;
      options.retrying?.(true);
      try {
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new DOMException("Cancelled", "AbortError"));
          };
          const timer = setTimeout(() => {
            options.signal.removeEventListener("abort", abort);
            resolve();
          }, delay);
          options.signal.addEventListener("abort", abort, { once: true });
          if (options.signal.aborted) abort();
        });
      } finally {
        options.retrying?.(false);
      }
    }
  }
}
