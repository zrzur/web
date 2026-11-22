/**
 * Sends what the desktop app reports (rich presence) to the server without
 * passing its limit of 5 changes in 20 seconds: at most one message every
 * `gap` ms, the newest value of each source wins, nothing is sent twice in
 * a row, and after a reconnect both are sent again. Pure: timers and the
 * send are passed in, so unit tests drive it.
 */

export type Source = "Rpc" | "Desktop";

export type Sender<A> = {
  /** A new value from the desktop (`null` clears) */
  set(source: Source, activity: A | null): void;
  /** The gateway is back: the server forgot this session's activities */
  reconnected(): void;
  /** Stop all timers */
  stop(): void;
};

export function createActivitySender<A>(options: {
  send: (source: Source, activity: A | null) => void;
  /** Wait between two messages; 4.5 s keeps 5 in 20 s with room */
  gap?: number;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}): Sender<A> {
  const gap = options.gap ?? 4500;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ??
    ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));

  /** What the server has, as far as this side knows */
  const sent = new Map<Source, string>();
  /** The newest value of each source */
  const latest = new Map<Source, A | null>();
  let last = -Infinity;
  let timer: unknown;

  const key = (activity: A | null) => JSON.stringify(activity ?? null);

  function waiting(): Source[] {
    return (["Rpc", "Desktop"] as Source[]).filter(
      (source) =>
        latest.has(source) &&
        key(latest.get(source)!) !== (sent.get(source) ?? key(null)),
    );
  }

  function flush() {
    timer = undefined;
    const next = waiting()[0];
    if (!next) return;
    const wait = last + gap - now();
    if (wait > 0) {
      timer = setTimer(flush, wait);
      return;
    }
    const value = latest.get(next) ?? null;
    sent.set(next, key(value));
    last = now();
    options.send(next, value);
    if (waiting().length) timer = setTimer(flush, gap);
  }

  return {
    set(source, activity) {
      latest.set(source, activity);
      if (timer === undefined) flush();
    },
    reconnected() {
      sent.clear();
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
      flush();
    },
    stop() {
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
    },
  };
}
