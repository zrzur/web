import {
  type HistoryWindow,
  addLive,
  addNewer,
  addOlder,
  dropNewest,
  emptyWindow,
  fromLatest,
  fromNearby,
  markStale,
  nearestId,
  removeIds,
} from "./window";

/**
 * The one owner of a channel's loaded history: what is loaded, what is being
 * asked for, what failed, and how many messages the reader has not seen.
 * It knows nothing about the DOM or the UI framework: it asks a `source` for
 * pages, tells a `view` where to go, and reports every state through
 * `onChange`. The message list renders that state and nothing else.
 */

/** Rows asked for when a channel opens */
export const INITIAL_PAGE = 30;
/** Rows asked for per page, and around a message */
export const PAGE = 50;
/** Rows added per frame, so a page never stalls scrolling */
export const ROWS_PER_FRAME = 15;
/** A request with no answer after this long counts as failed */
const REQUEST_TIMEOUT_MS = 20_000;

/** What is being asked for */
export type Pending = "initial" | "older" | "newer" | "present" | "around";

export interface HistoryState<T extends { id: string }> {
  window: HistoryWindow<T>;
  /** The request that is running, if any */
  pending: Pending | undefined;
  /** The request that failed and waits for "Try again" */
  failed: Pending | undefined;
  /** Messages that arrived while the reader was not at the present */
  unseen: number;
}

/** The server's four ways to read a channel */
export interface HistorySource<T> {
  latest(limit: number): Promise<T[]>;
  before(id: string, limit: number): Promise<T[]>;
  after(id: string, limit: number): Promise<T[]>;
  nearby(id: string, limit: number): Promise<T[]>;
}

/** A place in the list that survives leaving the channel: a row and where it sat in the view */
export interface ScrollMark {
  id: string;
  /** The row's top edge, in pixels below the top edge of the view */
  offset: number;
}

/** Where the view goes after a change */
export type ViewMove =
  /** Stay on the rows the reader is looking at */
  | { to: "keep" }
  /** The newest message */
  | { to: "present"; glide: boolean }
  /** A message, in the middle of the view, highlighted */
  | { to: "message"; id: string; glide: boolean }
  /** A place saved earlier */
  | { to: "mark"; mark: ScrollMark };

/** What the controller needs from the screen */
export interface HistoryView {
  /** The reader sees the newest message right now */
  atPresent(): boolean;
  /**
   * Apply a change to the list, then move the view
   * @param change Updates the state (synchronously)
   */
  commit(change: () => void, move: ViewMove): void;
  /** Resolves once the last change is on screen */
  nextFrame(): Promise<void>;
  /**
   * Resolves once the reader's finger is off the list and it has stopped
   * gliding (or after `maxWaitMs`): moving the list under a touch scroll
   * stops the scroll
   */
  settled(maxWaitMs?: number): Promise<void>;
  /** Resolves when rows may be added on this side without disturbing a touch scroll */
  ready(side: "older" | "newer"): Promise<void>;
  /** How many rows the list keeps on this screen */
  rowLimit(): number;
}

/** A window put aside when the reader leaves a channel */
export interface HistorySnapshot<T extends { id: string }> {
  window: HistoryWindow<T>;
  mark?: ScrollMark;
}

export function createHistory<T extends { id: string }>(options: {
  source: HistorySource<T>;
  view: HistoryView;
  /** Whether the reader wrote this message */
  isOwn(message: T): boolean;
  onChange(state: HistoryState<T>): void;
  timeoutMs?: number;
}) {
  const { source, view } = options;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  let state: HistoryState<T> = {
    window: emptyWindow(),
    pending: undefined,
    failed: undefined,
    unseen: 0,
  };

  /**
   * Every open and jump takes a new ticket; an answer whose ticket is no
   * longer current is dropped. Disposing takes the last one.
   */
  let ticket = 0;
  let disposed = false;

  /** Messages that arrive while a page that will be live is on its way */
  let arrivals: T[] | undefined;

  /** The message a running "around" request is for */
  let aroundTarget: string | undefined;

  /** What `retry` repeats */
  let again: (() => Promise<void>) | undefined;

  function set(patch: Partial<HistoryState<T>>) {
    state = { ...state, ...patch };
    options.onChange(state);
  }

  options.onChange(state);

  /** Reject when the server does not answer in time */
  function inTime<R>(request: Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("history request timed out")),
        timeoutMs,
      );
      request.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /**
   * Run a request that replaces the window (open, jump). It pre-empts
   * whatever was running.
   */
  async function replace(
    kind: "initial" | "present" | "around",
    request: () => Promise<T[]>,
    build: (page: T[]) => HistoryWindow<T>,
    move: (window: HistoryWindow<T>) => ViewMove,
    stage: boolean,
  ) {
    const mine = ++ticket;
    arrivals = [];
    aroundTarget = undefined;
    again = () => replace(kind, request, build, move, stage);
    set({ pending: kind, failed: undefined });

    let page: T[];
    try {
      page = await inTime(request());
    } catch {
      if (mine !== ticket) return;
      arrivals = undefined;
      set({ pending: undefined, failed: kind });
      return;
    }
    if (mine !== ticket) return;

    let window = build(page);
    // a message that arrived meanwhile belongs to a live window
    for (const message of arrivals) {
      window = addLive(window, message, { trim: false, limit: Infinity });
    }
    arrivals = undefined;

    const target = move(window);
    const unseen = window.atEnd && target.to === "present" ? 0 : state.unseen;

    // the newest rows first, so the channel shows at once; the rest above them
    if (stage && window.items.length > ROWS_PER_FRAME) {
      const first = window;
      view.commit(
        () =>
          set({
            window: {
              ...first,
              items: first.items.slice(0, ROWS_PER_FRAME),
              atStart: false,
            },
            unseen,
          }),
        target,
      );
      await view.nextFrame();
      if (mine !== ticket) return;
      // rows that arrived during that frame are already in the state
      window = {
        ...window,
        items: mergeKeeping(state.window.items, window.items),
      };
    }

    const whole = window;
    view.commit(
      () => set({ window: whole, unseen, pending: undefined }),
      target,
    );
    again = undefined;
  }

  /** Load the page around a message and land on it */
  function around(target: string) {
    const running = replace(
      "around",
      () => source.nearby(target, PAGE),
      (page) => fromNearby(page, target, PAGE),
      (window) => ({
        to: "message",
        id: nearestId(window.items, target) ?? target,
        glide: false,
      }),
      false,
    );
    aroundTarget = target;
    return running;
  }

  /** `shown` (which may hold newer arrivals) plus the rows of `all` it lacks */
  function mergeKeeping(shown: T[], all: T[]) {
    const have = new Set(shown.map((item) => item.id));
    return [...shown, ...all.filter((item) => !have.has(item.id))].sort(
      (a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
  }

  /** Run a request that extends the window on one side */
  async function page(side: "older" | "newer") {
    if (disposed || state.pending || state.failed === side) return;
    const { window } = state;
    if (!window.items.length) return;
    if (side === "older" ? window.atStart : window.atEnd) return;

    const mine = ticket;
    again = () => page(side);
    set({ pending: side, failed: undefined });

    let rows: T[];
    try {
      rows = await inTime(
        side === "older"
          ? source.before(window.items[window.items.length - 1].id, PAGE)
          : source.after(window.items[0].id, PAGE),
      );
    } catch {
      if (mine !== ticket) return;
      set({ pending: undefined, failed: side });
      return;
    }
    if (mine !== ticket) return;

    // newest first, whatever order the server used
    rows = [...rows].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

    for (let shown = 0; ; ) {
      shown = Math.min(rows.length, shown + ROWS_PER_FRAME);
      const last = shown === rows.length;
      // older rows join from the newest of the page down, newer rows from the oldest up
      const part =
        side === "older"
          ? rows.slice(0, shown)
          : rows.slice(rows.length - shown);
      // the edge is only known once the whole page is in
      const limit = last ? PAGE : 0;
      // rows added below the view have to be made up for by moving the
      // list, which the view may want to put off for a moment under a finger
      await view.ready(side);
      if (mine !== ticket) return;
      view.commit(
        () => {
          // Older rows go above the view and move nothing, so they are added
          // at once, also under a finger; the rows this pushes over the limit
          // are below the view and are dropped afterwards (tidy). Newer rows
          // push out the oldest ones, above the view, which moves nothing.
          const next =
            side === "older"
              ? addOlder(state.window, part, limit, Infinity)
              : addNewer(state.window, part, limit, view.rowLimit());
          set({
            window: next.window,
            pending: last ? undefined : side,
            // the reader is back in a live window: what arrived meanwhile is in it
            unseen:
              side === "newer" && next.window.atEnd && view.atPresent()
                ? 0
                : state.unseen,
          });
        },
        { to: "keep" },
      );
      if (last) break;
      await view.nextFrame();
      if (mine !== ticket) return;
    }
    again = undefined;
    if (side === "older") await tidy(mine);
  }

  /**
   * Drop the newest rows past the limit, once that can be done without
   * disturbing a touch scroll (it moves the list). A list that has grown to
   * twice the limit under a finger that never lifts is cut anyway.
   */
  async function tidy(mine: number) {
    const over = (factor: number) =>
      state.window.items.length > view.rowLimit() * factor;
    if (!over(1)) return;
    if (!over(2)) {
      await view.settled();
      if (mine !== ticket || disposed || !over(1)) return;
    }
    view.commit(
      () => set({ window: dropNewest(state.window, view.rowLimit()) }),
      { to: "keep" },
    );
  }

  return {
    /**
     * Load a channel: its newest page, the page around a message, or a
     * window that was put aside
     */
    async open(
      from: { around?: string; restore?: HistorySnapshot<T> } = {},
    ): Promise<void> {
      if (disposed) return;
      if (from.restore && !from.around) {
        ++ticket;
        arrivals = undefined;
        again = undefined;
        const { window, mark } = from.restore;
        view.commit(
          () =>
            set({ window, pending: undefined, failed: undefined, unseen: 0 }),
          window.atEnd || !mark
            ? { to: "present", glide: false }
            : { to: "mark", mark },
        );
        return;
      }

      // keep what is on screen until the answer is in (a reload must not blank the list)
      if (from.around) return around(from.around);

      return replace(
        "initial",
        () => source.latest(INITIAL_PAGE),
        (page) => fromLatest(page, INITIAL_PAGE),
        () => ({ to: "present", glide: false }),
        true,
      );
    },

    /** The page above the oldest loaded row */
    loadOlder: () => page("older"),

    /** The page below the newest loaded row */
    loadNewer: () => page("newer"),

    /** Go to the newest message */
    async toPresent(): Promise<void> {
      if (disposed) return;
      if (state.window.atEnd && state.window.items.length) {
        view.commit(() => set({ unseen: 0 }), { to: "present", glide: true });
        return;
      }
      return replace(
        "present",
        () => source.latest(PAGE),
        (page) => fromLatest(page, PAGE),
        () => ({ to: "present", glide: false }),
        false,
      );
    },

    /**
     * Go to a message. An id that is not a message (a time, or a message that
     * was deleted) lands on the first message after it.
     */
    async toMessage(target: string): Promise<void> {
      if (disposed) return;
      // already on its way (a channel opened on this very message)
      if (state.pending === "around" && aroundTarget === target) return;
      const { items, atStart, atEnd } = state.window;
      const covered =
        items.length > 0 &&
        (target >= items[items.length - 1].id || atStart) &&
        (target <= items[0].id || atEnd);
      if (covered) {
        const id = nearestId(items, target);
        if (id) {
          view.commit(() => {}, { to: "message", id, glide: true });
          return;
        }
      }
      return around(target);
    },

    /** Repeat the request that failed */
    async retry(): Promise<void> {
      if (disposed || !state.failed || !again) return;
      const run = again;
      set({ failed: undefined });
      return run();
    },

    /** A message was sent to this channel */
    received(message: T) {
      if (disposed) return;
      if (arrivals) arrivals.push(message);

      const atPresent = view.atPresent();
      const counted = !atPresent && !options.isOwn(message);
      const window = addLive(state.window, message, {
        trim: atPresent,
        limit: view.rowLimit(),
      });
      if (window === state.window && !counted) return;

      view.commit(
        () => set({ window, unseen: state.unseen + (counted ? 1 : 0) }),
        { to: "keep" },
      );
    },

    /** Messages were deleted */
    removed(ids: string[]) {
      if (disposed) return;
      const window = removeIds(state.window, ids);
      if (window !== state.window) {
        view.commit(() => set({ window }), { to: "keep" });
      }
    },

    /** The reader is looking at the newest message */
    seen() {
      if (!disposed && state.unseen) set({ unseen: 0 });
    },

    /**
     * The connection is back; messages may have been missed. At the present
     * the newest page replaces the list. While the reader is elsewhere
     * nothing moves: the newer side is asked for again as they scroll down.
     */
    async reconnected(): Promise<void> {
      if (disposed) return;
      if (state.pending === "initial" || state.pending === "present") return;
      if (
        !state.window.items.length ||
        (state.window.atEnd && view.atPresent())
      ) {
        return replace(
          "initial",
          () => source.latest(INITIAL_PAGE),
          (page) => fromLatest(page, INITIAL_PAGE),
          () => ({ to: "present", glide: false }),
          false,
        );
      }
      set({ window: markStale(state.window), failed: undefined });
    },

    /** The window as it is, to put aside */
    snapshot(): HistorySnapshot<T> {
      return { window: state.window };
    },

    /** A request is running or the first page has not arrived */
    state: () => state,

    /** The list is gone: late answers change nothing */
    dispose() {
      disposed = true;
      ++ticket;
      arrivals = undefined;
      again = undefined;
    },
  };
}

export type History<T extends { id: string }> = ReturnType<
  typeof createHistory<T>
>;
