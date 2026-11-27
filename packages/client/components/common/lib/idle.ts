/**
 * Run a check once the first screen is up and the page is idle, then
 * every `everyMs` while the page is shown. Checks that are not urgent
 * (notices, requests) no longer compete with the app's first requests, and
 * a hidden tab sends none.
 * @returns Stops it
 */
export function whenIdleAndEvery(run: () => void, everyMs: number) {
  let stopped = false;
  let last = 0;
  const tick = () => {
    if (stopped || document.hidden) return;
    last = Date.now();
    run();
  };
  const idle = globalThis.requestIdleCallback
    ? (fn: () => void) => globalThis.requestIdleCallback(fn, { timeout: 4000 })
    : (fn: () => void) => setTimeout(fn, 1500);
  idle(tick);
  const timer = setInterval(tick, everyMs);
  // back to the tab after a while away: look again
  const onVisible = () => {
    if (!document.hidden && Date.now() - last > 60_000) tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
