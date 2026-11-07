type Load = () => Promise<unknown>;

type Connection = { saveData?: boolean; effectiveType?: string };

/** Longest wait for an idle moment before loading anyway */
const IDLE_TIMEOUT = 4_000;

/**
 * Pause before each further piece. Compiling the settings code is a long task,
 * and right after opening the app is when people are clicking around
 */
const PIECE_GAP = 5_000;

/**
 * Screens people open next: their code is fetched once the app is idle, so the
 * first open is as quick as the second. The worker keeps it for later visits.
 */
export const NEXT_SCREENS: Load[] = [
  () => import("./channels/ChannelPage"),
  () => import("@revolt/modal/modals/Settings"),
];

/** Whether downloading ahead is welcome on this connection */
export function canLoadAhead(connection?: Connection) {
  return !connection?.saveData && !connection?.effectiveType?.includes("2g");
}

/**
 * Load the given code one piece at a time, each when the browser is idle.
 * A piece that fails is left for its screen to load and report.
 * @returns Stop loading what has not started yet
 */
export function preloadWhenIdle(loads: Load[]) {
  const connection = (navigator as Navigator & { connection?: Connection })
    .connection;
  if (!canLoadAhead(connection)) return () => undefined;

  let stopped = false;
  let cancelWait = () => {};

  const idle = (next: () => void) => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(next, { timeout: IDLE_TIMEOUT });
      cancelWait = () => window.cancelIdleCallback?.(id);
    } else {
      const id = setTimeout(next, IDLE_TIMEOUT / 2);
      cancelWait = () => clearTimeout(id);
    }
  };

  const step = (index: number) => {
    if (stopped || index >= loads.length) return;
    idle(() => {
      loads[index]()
        .catch(() => undefined)
        .finally(() => {
          if (stopped) return;
          const id = setTimeout(() => step(index + 1), PIECE_GAP);
          cancelWait = () => clearTimeout(id);
        });
    });
  };

  step(0);

  return () => {
    stopped = true;
    cancelWait();
  };
}
