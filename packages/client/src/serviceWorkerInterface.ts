import { createSignal } from "solid-js";

import { watchForUpdate } from "./swUpdate";

declare const __ZRZUR_PWA_SCOPE__: string;

/** Check for a new release this often while the page stays open */
const CHECK_EVERY_MS = 36e5;

const [pendingUpdate, setPendingUpdate] = createSignal<() => void>();

/**
 * Set when a new release waits: call it to move to the release (the page
 * reloads). The page never reloads for a release by itself, see swUpdate.ts.
 */
export { pendingUpdate };

async function register() {
  const registration = await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}serviceWorker.js`,
    { scope: __ZRZUR_PWA_SCOPE__ },
  );

  watchForUpdate({
    container: navigator.serviceWorker,
    registration,
    pageAge: () => performance.now(),
    reload: () => window.location.reload(),
    onPending: (apply) => setPendingUpdate(() => apply),
  });

  // a phone suspends timers while the app is in the background: also check
  // when the app is brought back after a long time
  let checked = Date.now();
  const check = () => {
    checked = Date.now();
    registration.update().catch(() => {});
  };
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      Date.now() - checked > CHECK_EVERY_MS
    )
      check();
  });
}

// no service worker in the dev server (vite.config.ts); after the page has
// loaded, so installing it never competes with the first screen
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const start = () =>
    register().catch((error) =>
      console.warn("[app] service worker not registered", error),
    );
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
