/**
 * What happens to a message of the outbox after an attempt to send it.
 *
 * Every message keeps one idempotency key for its whole life, also across
 * retries and restarts: the server answers a second post with the same key
 * with `DuplicateNonce`, so a message whose first answer was lost on the way
 * is never posted twice.
 */

export type OutboxOutcome =
  /** The server has it (now, or from an earlier attempt): leave the outbox */
  | { kind: "sent" }
  /** The network failed: it waits and is sent again by itself */
  | { kind: "wait" }
  /** The server refused it: it stays, marked, until the person decides */
  | { kind: "failed"; error?: string };

/** API error types that mean "this exact message is already posted" */
const ALREADY_SENT = new Set(["DuplicateNonce"]);

/**
 * API error types another try can fix by itself: the server or the network
 * in between, not the message.
 */
const TRY_AGAIN = new Set(["InternalError", "DatabaseError", "ProxyError"]);

/** Read the outcome of a failed attempt from what was thrown */
export function outcomeOfError(error: unknown): OutboxOutcome {
  const type = (error as { type?: unknown } | null | undefined)?.type;
  if (typeof type !== "string") return { kind: "wait" }; // no answer at all
  if (ALREADY_SENT.has(type)) return { kind: "sent" };
  if (TRY_AGAIN.has(type)) return { kind: "wait" };
  return { kind: "failed", error: type };
}

/** Pause before the queue is tried again after a failed pass, in milliseconds */
export function outboxRetryDelay(failures: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, failures - 1));
}

/** Whether a stored entry is one the queue sends by itself */
export function waitsToBeSent(entry: { status: string }): boolean {
  return entry.status === "unsent";
}
