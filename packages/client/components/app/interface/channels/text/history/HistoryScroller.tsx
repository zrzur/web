import {
  type Accessor,
  type JSX,
  Show,
  batch,
  createEffect,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { cva } from "styled-system/css";

import { Placeholders } from "./Placeholders";
import type { HistoryView, Pending, ScrollMark, ViewMove } from "./controller";
import {
  type PageSide,
  isAtPresent,
  rowsToKeep,
  scrollTopToShowRow,
  travel,
  wantedPage,
} from "./reader";

/** What the reader's position means for the list around the scroller */
export interface ReaderPosition {
  /** Loaded rows below the view, in pixels */
  below: number;
  /** Height of the view */
  viewport: number;
  /** The reader sees the newest message */
  atPresent: boolean;
  /** Some of the newest loaded message is on screen */
  newestVisible: boolean;
}

/** The scroller as the history controller and the message list use it */
export interface HistoryScrollerApi extends HistoryView {
  /** A place to come back to after leaving the channel */
  capture(): ScrollMark | undefined;
}

interface Props {
  /** The first message of the channel is loaded */
  atStart: Accessor<boolean>;
  /** The newest message of the channel is loaded */
  atEnd: Accessor<boolean>;
  /** The request that is running */
  pending: Accessor<Pending | undefined>;
  /** The request that failed */
  failed: Accessor<Pending | undefined>;
  /** Nothing is loaded yet */
  empty: Accessor<boolean>;
  /** The element whose children are the rows */
  rows: Accessor<HTMLElement | undefined>;
  /** Fewer animations wanted */
  reducedMotion: Accessor<boolean>;
  /** A page is wanted on this side */
  onWant(side: PageSide): void;
  /** The reader moved (called only when something changed) */
  onReader(position: ReaderPosition): void;
  /** Shown in place of the placeholders of a side whose page failed */
  failure(side: PageSide): JSX.Element;
  ref(api: HistoryScrollerApi): void;
  children: JSX.Element;
}

/** After a touch scroll ends the list may still glide for this long */
const TOUCH_SETTLE_MS = 150;

/**
 * Browsers with their own scroll anchoring (Chromium, Firefox) are the ones
 * where a running touch scroll has to be held when rows are added
 * (see holdUnderTouch); Safari has neither.
 */
const TOUCH_SCROLL_NEEDS_HOLD =
  typeof CSS !== "undefined" && !!CSS.supports?.("overflow-anchor", "auto");

/**
 * The longest an older page waits for a touch scroll to rest before its rows
 * are added anyway (browsers without a held scroll, see `ready`)
 */
const OLDER_WAIT_MS = 500;

/** After a jump, late-loading rows may still shift the target for this long */
const LANDING_MS = 1500;

/** The animation that marks the message a jump landed on (panda.config.ts) */
const HIGHLIGHT_ANIMATION = "highlightMessage";

/**
 * The scrolling of a message list: it measures where the reader is, asks for
 * pages before the reader runs out of rows, and keeps the rows the reader is
 * looking at still whenever the list changes around them.
 *
 * The list is a column-reverse scroller: scrollTop is 0 at the newest end
 * and negative above it, so rows added above the view never move it and the
 * view stays at the bottom while it is there. Everything else (rows added or
 * removed below the view, placeholders appearing, late images) is corrected
 * here, by one mechanism in every browser: the browser's own scroll
 * anchoring is switched off.
 */
export function HistoryScroller(props: Props) {
  let scroller!: HTMLDivElement;
  let content!: HTMLDivElement;

  // --- touch: never move the list under a finger or a glide (iOS stops the glide)

  let activeTouches = 0;
  let lastTouchScroll = 0;

  const touchScrolling = () =>
    activeTouches > 0 || performance.now() - lastTouchScroll < TOUCH_SETTLE_MS;

  let alive = true;
  onCleanup(() => {
    alive = false;
    activeTouches = 0;
  });

  /**
   * Chromium keeps a running touch scroll at its old position measured from
   * the top of the list: rows added above the view would shift it by their
   * height one frame later (measured: 785 px for 15 rows). A scroll position
   * set from here makes the running scroll take the new layout; the finger
   * keeps scrolling from there.
   */
  function holdUnderTouch() {
    if (!TOUCH_SCROLL_NEEDS_HOLD) return;
    const top = scroller.scrollTop;
    scroller.scrollTop = top - 1;
    scroller.scrollTop = top;
  }

  /**
   * Resolves when rows may be added on a side. Older rows go above the view:
   * at once where a touch scroll can be held (above). Elsewhere (Safari:
   * setting the position stops a glide) they wait for the scroll to rest,
   * but only briefly, and not at all once the reader has reached the end of
   * the loaded rows: there the placeholders are on screen and there is no
   * glide worth keeping. Newer rows always need the position set, so they
   * wait a moment for a calm frame.
   */
  function ready(side: PageSide) {
    if (side === "older") {
      return TOUCH_SCROLL_NEEDS_HOLD
        ? Promise.resolve()
        : settled(OLDER_WAIT_MS, atOldestLoaded);
    }
    return settled(300);
  }

  /** The reader is within half a screen of the oldest loaded row */
  function atOldestLoaded() {
    const rows = rowsElement();
    if (!rows) return true;
    const view = scroller.getBoundingClientRect();
    return view.top - rows.getBoundingClientRect().top <= view.height / 2;
  }

  async function settled(maxWaitMs = Infinity, enough?: () => boolean) {
    const until = performance.now() + maxWaitMs;
    while (
      alive &&
      touchScrolling() &&
      performance.now() < until &&
      !enough?.()
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // --- measuring

  /** The rows of the list, or nothing before they are drawn */
  const rowsElement = () => {
    const el = props.rows();
    return el?.isConnected ? el : undefined;
  };

  /** The view is at the bottom of a live list (where new rows simply appear) */
  const atBottom = () =>
    isAtPresent({ atEnd: props.atEnd(), below: -scroller.scrollTop });

  let lastReader = "";

  /** Report the reader's position and ask for a page when one is due */
  function measure() {
    if (!alive) return;
    const rows = rowsElement();
    const view = scroller.getBoundingClientRect();
    if (!view.height) return;

    let above = 0;
    let below = 0;
    let newestVisible = false;
    if (rows) {
      const box = rows.getBoundingClientRect();
      above = Math.max(0, view.top - box.top);
      below = Math.max(0, box.bottom - view.bottom);

      // the newest message is the last row that carries a message id
      // (after it come messages being sent and the end padding)
      for (
        let row = rows.lastElementChild;
        row;
        row = row.previousElementSibling
      ) {
        if (!row.id) continue;
        const rowBox = row.getBoundingClientRect();
        newestVisible = rowBox.top < view.bottom && rowBox.bottom > view.top;
        break;
      }
    }

    const position: ReaderPosition = {
      below: Math.round(below),
      viewport: Math.round(view.height),
      atPresent: !props.empty() && atBottom(),
      newestVisible,
    };
    const key = `${position.below}|${position.viewport}|${position.atPresent}|${newestVisible}`;
    if (key !== lastReader) {
      lastReader = key;
      props.onReader(position);
    }

    const pending = props.pending();
    const failed = props.failed();
    const side = wantedPage({
      atStart: props.atStart(),
      atEnd: props.atEnd(),
      busy: !!pending,
      failed: failed === "older" || failed === "newer" ? failed : undefined,
      above,
      below,
      viewport: view.height,
      empty: props.empty() || !rows,
    });
    if (side) props.onWant(side);
  }

  // --- keeping the reader's rows still

  /** Rows on screen and where their top edges were, top-most first */
  let anchors: { el: Element; top: number }[] = [];

  function captureAnchors() {
    anchors = [];
    const rows = rowsElement();
    if (!rows) return;
    const list = rows.children;
    const viewTop = scroller.getBoundingClientRect().top;

    // rows are in document order: find the first one that ends below the top edge
    let low = 0;
    let high = list.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (list[mid].getBoundingClientRect().bottom > viewTop + 1) high = mid;
      else low = mid + 1;
    }
    // a few, so one that is deleted or dropped does not lose the place
    for (let i = low; i < list.length && anchors.length < 6; i++) {
      const box = list[i].getBoundingClientRect();
      if (box.height) anchors.push({ el: list[i], top: box.top - viewTop });
    }
  }

  // --- rows the browser may skip
  //
  // Message rows have content-visibility: auto (MessageContainer): a row out
  // of view is not styled, laid out or painted, and counts with the size it
  // last had, or an estimate if it was never drawn. Rows above the reader
  // may be estimates: in this column-reverse list they never move the view.
  // Two cases must be exact:
  // - while a jump lands (a link to a message, a reply, the first unread,
  //   coming back to a channel) every row is (`data-exact-rows` on the
  //   content): there the measurements decide where the view goes and which
  //   page comes next;
  // - rows added below the reader (a newer page after a jump) are exact until
  //   they have been drawn once (`data-fresh`), so the correction in commit
  //   uses their real height. Otherwise they would grow when drawn, and under
  //   a finger (touchScrolling) nothing corrects that: the text would move.
  // (Marking the reader's row and keeping every row below it exact was tried:
  // the sibling selector restyled the whole list on every scroll step.)

  // Chromium engines (Chrome, Edge, the desktop app, Android's WebView) keep
  // a column-reverse list still when rows above the reader change size;
  // WebKit did not (the text moved by up to 256 px), so there every row is
  // drawn as before. `userAgentData` exists in Chromium engines only.
  const skipRows =
    typeof navigator !== "undefined" && "userAgentData" in navigator;
  onMount(() => content.toggleAttribute("data-skip-rows", skipRows));

  const freshRows = new Set<Element>();
  let freshFrame = 0;
  /** Mark rows that are new since `known` and come after `reader` */
  function markFresh(known: Set<Element>, reader: Element | undefined) {
    const rows = rowsElement();
    if (!rows || !reader || reader.parentElement !== rows) return;
    for (let el = reader.nextElementSibling; el; el = el.nextElementSibling) {
      if (known.has(el) || freshRows.has(el)) continue;
      el.setAttribute("data-fresh", "");
      freshRows.add(el);
    }
    // two frames: drawn once, so the browser keeps their real height
    if (freshRows.size && !freshFrame) {
      freshFrame = requestAnimationFrame(() => {
        freshFrame = requestAnimationFrame(releaseFresh);
      });
    }
  }
  function releaseFresh() {
    freshFrame = 0;
    for (const el of freshRows) el.removeAttribute("data-fresh");
    freshRows.clear();
  }
  onCleanup(() => cancelAnimationFrame(freshFrame));

  let exactTimer: ReturnType<typeof setTimeout> | undefined;
  function exactRows(on: boolean) {
    clearTimeout(exactTimer);
    exactTimer = undefined;
    content?.toggleAttribute("data-exact-rows", on);
    // a landing that is never ended by the list or the reader still ends
    if (on) exactTimer = setTimeout(() => exactRows(false), LANDING_MS + 500);
  }
  onCleanup(() => clearTimeout(exactTimer));

  /** Put the remembered rows back where they were */
  function restoreAnchors() {
    const rows = rowsElement();
    if (!rows) return;
    const viewTop = scroller.getBoundingClientRect().top;
    for (const anchor of anchors) {
      if (anchor.el.parentElement !== rows) continue;
      const delta =
        anchor.el.getBoundingClientRect().top - viewTop - anchor.top;
      if (Math.abs(delta) >= 1) scroller.scrollTop += delta;
      break;
    }
    captureAnchors();
  }

  // --- moving the view

  /** A jump whose target may still shift while rows finish loading */
  let landing: { move: ViewMove; until: number } | undefined;

  /** A move asked for before the rows were drawn */
  let waiting: ViewMove | undefined;

  function scrollTo(top: number, glide: boolean) {
    const behavior = glide
      ? travel(
          top - scroller.scrollTop,
          scroller.clientHeight,
          props.reducedMotion(),
        )
      : "instant";
    scroller.scrollTo({ top, behavior });
  }

  function findRow(id: string) {
    return (
      rowsElement()?.querySelector(`[id="${CSS.escape(id)}"]`) ?? undefined
    );
  }

  /** Play the "this is the message" mark again (a jump to the same message twice) */
  function highlight(row: Element) {
    for (const animation of row.getAnimations()) {
      if ((animation as CSSAnimation).animationName === HIGHLIGHT_ANIMATION) {
        animation.cancel();
        animation.play();
      }
    }
  }

  function apply(move: ViewMove, again = false) {
    if (move.to === "keep") return;
    // a jump into the history measures rows on both sides of its target
    if (!again && move.to !== "present") exactRows(true);
    if (!rowsElement() && move.to !== "present") {
      waiting = move;
      return;
    }

    if (move.to === "present") {
      scrollTo(0, move.glide && !again);
    } else if (move.to === "message") {
      const row = findRow(move.id);
      if (!row) return;
      const view = scroller.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      scrollTo(
        scrollTopToShowRow({
          scrollTop: scroller.scrollTop,
          viewport: view.height,
          scrollHeight: scroller.scrollHeight,
          rowTop: box.top - view.top,
          rowHeight: box.height,
        }),
        move.glide && !again,
      );
      if (!again) highlight(row);
    } else {
      const row = findRow(move.mark.id);
      if (row) {
        const view = scroller.getBoundingClientRect();
        scroller.scrollTop +=
          row.getBoundingClientRect().top - view.top - move.mark.offset;
      } else {
        scroller.scrollTop = 0;
      }
    }

    if (!again) landing = { move, until: performance.now() + LANDING_MS };
    captureAnchors();
  }

  /** The reader took over: a landing is no longer corrected */
  const userInput = () => {
    if (landing) exactRows(false);
    landing = undefined;
  };

  // --- the contract with the controller

  const api: HistoryScrollerApi = {
    atPresent: () => !props.empty() && atBottom(),

    commit(change, move) {
      if (!alive) return;
      const wasAtBottom = atBottom();
      // Rows may have changed since the last look without going through here
      // (the unread divider, an edit): put the reader's rows back first, so
      // that change is not taken for where they were
      if (wasAtBottom) captureAnchors();
      else restoreAnchors();
      const known = new Set(rowsElement()?.children ?? []);
      const reader = anchors[0]?.el;
      batch(change);

      if (move.to === "keep") {
        // at the bottom new rows simply appear; anywhere else nothing moves
        const hold = () => {
          if (!alive) return;
          markFresh(known, reader);
          if (wasAtBottom) scroller.scrollTop = 0;
          else {
            restoreAnchors();
            if (touchScrolling()) holdUnderTouch();
          }
        };
        hold();
        // When this runs inside a larger batch (an event of the client),
        // the rows are only drawn when that batch ends: hold again then,
        // still before anything is painted
        queueMicrotask(() => {
          hold();
          measure();
        });
      } else {
        apply(move);
      }
      measure();
    },

    nextFrame: () =>
      new Promise<void>((resolve) => {
        // a hidden tab has no frames
        const hidden = setTimeout(resolve, 100);
        requestAnimationFrame(() => {
          clearTimeout(hidden);
          setTimeout(resolve);
        });
      }),

    settled,
    ready,

    rowLimit() {
      const rows = rowsElement();
      return rowsToKeep({
        viewport: scroller.clientHeight,
        rowsHeight: rows?.getBoundingClientRect().height ?? 0,
        count: rows?.children.length ?? 0,
      });
    },

    capture() {
      captureAnchors();
      const first = anchors.find((anchor) => anchor.el.id);
      return first
        ? { id: first.el.id, offset: Math.round(first.top) }
        : undefined;
    },
  };

  // eslint-disable-next-line solid/reactivity
  props.ref(api);

  // the rows were drawn: a move that waited for them
  createEffect(
    on(props.rows, (rows) => {
      if (rows && waiting) {
        const move = waiting;
        waiting = undefined;
        queueMicrotask(() => alive && apply(move));
      }
    }),
  );

  // a request ended, an edge was reached or a retry was asked: look again
  createEffect(
    on(
      () => [
        props.pending(),
        props.failed(),
        props.atStart(),
        props.atEnd(),
        props.rows(),
      ],
      () => queueMicrotask(measure),
      { defer: true },
    ),
  );

  onMount(() => {
    // the list or the view changed size: late images, edits, the phone
    // keyboard, a resized window
    const observer = new ResizeObserver((entries) => {
      if (!alive) return;
      const listChanged = entries.some((entry) => entry.target === content);
      if (landing && performance.now() < landing.until) {
        apply(landing.move, true);
      } else {
        if (landing) exactRows(false);
        landing = undefined;
        if (atBottom()) {
          if (scroller.scrollTop !== 0) scroller.scrollTop = 0;
        } else if (listChanged && !touchScrolling()) {
          restoreAnchors();
        } else {
          // only the view changed size (the phone keyboard, the window): the
          // rows above the message box stay where they are, as the browser
          // lays them out; remember the new positions
          captureAnchors();
        }
      }
      measure();
    });
    observer.observe(scroller);
    observer.observe(content);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      ref={scroller}
      data-message-scroller
      // reachable with Tab, so the arrow and page keys can scroll the
      // conversation when no message in view has a link or button
      tabIndex={0}
      use:scrollable={{
        direction: "y",
        class: container({ parent: true }),
      }}
      onWheel={userInput}
      onKeyDown={userInput}
      onPointerDown={userInput}
      onTouchStart={(e) => {
        userInput();
        activeTouches = e.touches.length;
      }}
      onTouchEnd={(e) => {
        activeTouches = e.touches.length;
        lastTouchScroll = performance.now();
      }}
      onTouchCancel={(e) => (activeTouches = e.touches.length)}
      onScroll={() => {
        if (touchScrolling()) {
          // keep extending the settle window while the glide continues,
          // and leave the scroll position alone so iOS can rubber-band
          lastTouchScroll = performance.now();
        } else if (scroller.scrollTop > 0) {
          // https://issues.chromium.org/issues/40829494: Chromium overscrolls
          // reverse columns, which breaks staying at the bottom
          scroller.scrollTop = 0;
        }
        captureAnchors();
        measure();
      }}
    >
      <div
        ref={content}
        class={container()}
        // when the whole history is loaded, pin a short conversation to the top
        style={{
          "min-height": props.atStart() ? "100%" : undefined,
          "justify-content": props.atStart() ? "flex-end" : undefined,
        }}
      >
        <div>
          <Show when={!props.atStart()}>
            <Show
              when={props.failed() !== "older"}
              fallback={props.failure("older")}
            >
              <Placeholders align="end" side="older" />
            </Show>
          </Show>
          {props.children}
          <Show when={!props.atEnd()}>
            <Show
              when={props.failed() !== "newer"}
              fallback={props.failure("newer")}
            >
              <Placeholders align="start" side="newer" />
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}

const container = cva({
  base: {
    display: "flex",
    flexDirection: "column-reverse",
  },
  variants: {
    parent: {
      true: {
        height: "100%",
        flexGrow: 1,
        overscrollBehaviorY: "contain",
        // one mechanism keeps the reader's rows still (see above), not two
        overflowAnchor: "none",
      },
      // The content column must never shrink to the viewport: an explicit
      // min-height replaces the flex automatic minimum, the column then shrinks,
      // and in a column-reverse scroller its overflow lands past the scroll origin
      // (bottom), where it is unreachable — newest messages end up under the composer.
      false: {
        flexShrink: 0,
      },
    },
  },
  defaultVariants: {
    parent: false,
  },
});
