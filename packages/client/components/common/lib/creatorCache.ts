import { createSignal } from "solid-js";

/**
 * What the app keeps about the creator rank. Nothing here but Solid itself,
 * so signing out can clear it without loading any of the settings code.
 *
 * The answer lives here and not in a resource of each component: the sidebar
 * and the page read one answer, a new one reaches both at once, and asking
 * again never takes away what they show meanwhile.
 */
const PREFIX = "zrzur:creator:";

/** Long enough for one visit, short enough that a new rank arrives by itself */
const KEEP_MS = 5 * 60 * 1000;

type Asked = {
  id: string;
  at: number;
  answer: Promise<unknown>;
  settled: boolean;
  /** saved while the answer was on its way */
  changes: ((answer: never) => unknown)[];
};

let shared: Asked | undefined;

const [known, setKnown] = createSignal<{ id: string; answer: unknown }>();
const [failed, setFailed] = createSignal<string>();
const [pending, setPending] = createSignal(false);

/**
 * The server's answer for this account, asked once however many ask.
 * `fresh` asks again unless a request is already on its way. Only an answer
 * that has never arrived counts as failed: a recheck that fails leaves what
 * the page shows, and the server still checks every request.
 */
export function sharedAnswer<T>(
  id: string,
  load: () => Promise<T>,
  options: { fresh?: boolean } = {},
) {
  if (
    shared?.id === id &&
    (!shared.settled || !options.fresh) &&
    Date.now() - shared.at < KEEP_MS
  ) {
    return shared.answer as Promise<T>;
  }
  const entry: Asked = {
    id,
    at: Date.now(),
    answer: Promise.resolve(),
    settled: false,
    changes: [],
  };
  entry.answer = load().then(
    (arrived) => {
      const value = entry.changes.reduce<unknown>(
        (answer, change) => change(answer as never),
        arrived,
      );
      entry.settled = true;
      if (shared === entry) {
        setKnown({ id, answer: value });
        setFailed(undefined);
        setPending(false);
      }
      return value;
    },
    (failure) => {
      entry.settled = true;
      if (shared === entry) {
        // a failure is never kept: the next try asks again
        shared = undefined;
        if (known()?.id !== id) setFailed(id);
        setPending(false);
      }
      throw failure;
    },
  );
  shared = entry;
  setPending(true);
  return entry.answer as Promise<T>;
}

/** The last answer for this account; none for any other */
export function knownAnswer<T>(id: string) {
  const current = known();
  return current?.id === id ? (current.answer as T) : undefined;
}

/** The server could not say, and there is no earlier answer */
export function answerFailed(id: string) {
  return failed() === id;
}

/** A request is on its way */
export function answerPending() {
  return pending();
}

/** A change the server just accepted, so a reopened page shows it */
export function patchSharedAnswer<T>(change: (answer: T) => T) {
  if (shared?.settled) {
    shared.answer = (shared.answer as Promise<T>).then(change);
  } else {
    shared?.changes.push(change as (answer: never) => unknown);
  }
  setKnown((current) =>
    current
      ? { id: current.id, answer: change(current.answer as T) }
      : undefined,
  );
}

export function dropSharedAnswer() {
  shared = undefined;
  setKnown(undefined);
  setFailed(undefined);
  setPending(false);
}

export function isRememberedCreator(userId: string | undefined) {
  if (!userId) return false;
  try {
    return localStorage.getItem(PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

export function rememberCreator(userId: string, creator: boolean) {
  try {
    if (creator) localStorage.setItem(PREFIX + userId, "1");
    else localStorage.removeItem(PREFIX + userId);
  } catch {
    // private windows may refuse: the row just waits for the answer
  }
}

/** On sign-out: nothing about one account stays for the next */
export function forgetCreators() {
  dropSharedAnswer();
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    );
    for (const key of keys) {
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // nothing could be stored either
  }
}
