/**
 * When a new release reaches an open page.
 *
 * The page never reloads by itself: that dropped what was being typed and
 * calls in progress. Two cases:
 *
 * - The page was opened after the release (it already runs the new files;
 *   index.html is never cached). The new service worker found while the page
 *   starts is told to take over quietly. Nothing reloads.
 * - The page was opened before the release. It is told an update is waiting
 *   (`onPending`) and shows "Update"; the reload happens when the person
 *   asks for it.
 */

/** A page this young already runs the release its service worker belongs to */
export const FRESH_PAGE_MS = 60_000;

/** After "Update": reload even if the new worker never reports taking over */
export const APPLY_TIMEOUT_MS = 4_000;

/** The parts of a service worker registration this needs */
export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: "statechange", listener: () => void): void;
}
export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: "updatefound", listener: () => void): void;
}
export interface ContainerLike {
  controller: unknown;
  addEventListener(type: "controllerchange", listener: () => void): void;
}

export interface UpdateWatch {
  container: ContainerLike;
  registration: RegistrationLike;
  /** Milliseconds since the page was opened */
  pageAge: () => number;
  reload: () => void;
  /** An update waits: call the function to move to it (reloads the page) */
  onPending: (apply: () => void) => void;
  setTimeout?: (run: () => void, ms: number) => unknown;
}

export function watchForUpdate(watch: UpdateWatch) {
  const { container, registration } = watch;
  const later = watch.setTimeout ?? ((run, ms) => setTimeout(run, ms));
  // a first visit has no worker yet: the first one is not an update
  const hadController = !!container.controller;
  let applying = false;
  let reloaded = false;

  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    watch.reload();
  };

  /** A new worker is installed and waits */
  const ready = (worker: WorkerLike) => {
    if (!hadController) return;
    if (watch.pageAge() < FRESH_PAGE_MS) {
      worker.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    watch.onPending(() => {
      applying = true;
      // the page may have been left open for days: ask the worker that
      // waits now, not the one seen when the row first showed
      (registration.waiting ?? worker).postMessage({ type: "SKIP_WAITING" });
      later(reload, APPLY_TIMEOUT_MS);
    });
  };

  const follow = (worker: WorkerLike | null) => {
    if (!worker) return;
    if (worker.state === "installed") return ready(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") ready(worker);
    });
  };

  if (registration.waiting) ready(registration.waiting);
  else follow(registration.installing);
  registration.addEventListener("updatefound", () =>
    follow(registration.installing),
  );

  container.addEventListener("controllerchange", () => {
    if (applying) return reload();
    if (!hadController) return;
    // another tab moved every page to the new release: this page still runs
    // the old files, so offer the reload (no worker to ask any more)
    if (watch.pageAge() >= FRESH_PAGE_MS) watch.onPending(reload);
  });
}
