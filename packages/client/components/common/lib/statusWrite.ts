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
 * The edit for a presence change: only the presence. Sending the text back
 * would replace its emoji and expiry, or bring back one that ran out.
 */
export function presencePatch(
  presence: NonNullable<NonNullable<API.DataEditUser["status"]>["presence"]>,
): API.DataEditUser {
  return { status: { presence } };
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
