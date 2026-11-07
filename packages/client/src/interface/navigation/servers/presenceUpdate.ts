import type { API } from "@zrzur/sdk/solid";

export type Presence = NonNullable<
  NonNullable<API.DataEditUser["status"]>["presence"]
>;

import { createSignal } from "solid-js";

import { statusRetryDelay as presenceRetryDelay } from "../../../../components/common/lib/statusWrite";
export { presenceRetryDelay };

/**
 * A status the user picked that is still being saved, so every place that
 * shows your status (menu, account bar) switches at once
 */
export const [pendingPresence, setPendingPresence] = createSignal<Presence>();
/** One request at a time; a newer choice replaces a choice waiting for retry. */
export function createPresenceUpdater(options: {
  save: (presence: Presence) => Promise<unknown>;
  pending: (presence: Presence | undefined) => void;
  retrying: (milliseconds: number | undefined) => void;
  saved: () => void;
  failed: (error: unknown) => void;
}) {
  let next: Presence | undefined;
  let inFlight: Presence | undefined;
  let running: Promise<void> | undefined;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wake: (() => void) | undefined;

  async function run() {
    let retries = 0;
    try {
      while (next && !disposed) {
        const target = next;
        next = undefined;
        inFlight = target;
        try {
          await options.save(target);
          if (disposed) return;
          retries = 0;
          if (!next) options.saved();
        } catch (error) {
          if (disposed) return;
          const delay = presenceRetryDelay(error);
          if (delay !== undefined && retries < 2) {
            retries++;
            next ??= target;
            options.retrying(delay);
            await new Promise<void>((resolve) => {
              wake = resolve;
              timer = setTimeout(resolve, delay);
            });
            timer = undefined;
            wake = undefined;
            if (!disposed) options.retrying(undefined);
          } else {
            next = undefined;
            options.failed(error);
          }
        }
      }
    } finally {
      inFlight = undefined;
      running = undefined;
      if (!disposed) {
        options.pending(undefined);
        options.retrying(undefined);
      }
    }
  }

  return {
    submit(presence: Presence) {
      if (disposed) return Promise.resolve();
      if (presence === inFlight && !next) return running ?? Promise.resolve();
      next = presence;
      options.pending(presence);
      running ??= run();
      return running;
    },
    dispose() {
      disposed = true;
      next = undefined;
      if (timer !== undefined) clearTimeout(timer);
      wake?.();
    },
  };
}
