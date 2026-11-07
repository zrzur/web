/** Longest wait between reconnect attempts, before jitter */
export const MAX_RETRY_SECONDS = 30;

/**
 * Seconds to wait before reconnect attempt number `failures`.
 *
 * Exponential backoff, capped: uncapped it reached ~17 minutes after ten
 * failures, so a short outage left clients offline long after the server was
 * back. The ±20% jitter still spreads reconnects out after an outage.
 */
export function reconnectDelay(failures: number, random = Math.random()) {
  return (
    Math.min(MAX_RETRY_SECONDS, Math.pow(2, failures) - 1) *
    (0.8 + random * 0.4)
  );
}
