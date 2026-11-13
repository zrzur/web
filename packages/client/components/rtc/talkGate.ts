export interface GateTimers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

/**
 * When push to talk is open. Several things can hold it (the key inside
 * the window, the key heard by the desktop app); it opens with the first
 * and, after the last one lets go, stays open for the release delay so the
 * end of a word is not cut off. A new press inside that time keeps it open.
 */
export function createTalkGate(
  apply: (open: boolean) => void,
  delay: () => number,
  timers: GateTimers = {
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
) {
  const holders = new Set<string>();
  let open = false;
  let closing: unknown;

  function cancelClose() {
    if (closing !== undefined) timers.clear(closing);
    closing = undefined;
  }
  function close() {
    cancelClose();
    if (!open) return;
    open = false;
    apply(false);
  }

  return {
    down(holder: string) {
      holders.add(holder);
      cancelClose();
      if (open) return;
      open = true;
      apply(true);
    },
    up(holder: string) {
      if (!holders.delete(holder) || holders.size || !open) return;
      const ms = delay();
      if (ms > 0) {
        cancelClose();
        closing = timers.set(() => {
          closing = undefined;
          close();
        }, ms);
      } else close();
    },
    /** Close now, whoever holds it (the call ended, the mode changed) */
    reset() {
      holders.clear();
      close();
    },
    get open() {
      return open;
    },
  };
}
