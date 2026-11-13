/**
 * Where the reader is in the loaded history, and what follows from it:
 * which page to ask for, whether the jump bar shows, how the view moves.
 * Pure rules; the list view measures, these decide.
 *
 * Distances are in CSS pixels. `above` / `below` are the loaded rows outside
 * the view on each side (placeholders are not rows).
 */

/** Sub-pixel scroll positions and a row's last few pixels still count as "at the bottom" */
const PRESENT_SLACK = 32;

/** Ask for the next page while this many screens of rows are still left */
const PREFETCH_SCREENS = 2;

/** A glide longer than this many screens is a cut instead */
const GLIDE_SCREENS = 3;

/** Space kept above a row that is taller than the view */
const TALL_ROW_MARGIN = 16;

export type PageSide = "older" | "newer";

/**
 * The reader sees the newest message: the window is live and the view is at
 * its bottom. Only then is a channel read, and only then do new messages
 * simply appear.
 */
export function isAtPresent(reader: { atEnd: boolean; below: number }) {
  return reader.atEnd && reader.below <= PRESENT_SLACK;
}

/**
 * The page to ask for now, if any
 */
export function wantedPage(reader: {
  atStart: boolean;
  atEnd: boolean;
  /** A request is running */
  busy: boolean;
  /** The side whose last request failed; it waits for "Try again" */
  failed: PageSide | undefined;
  above: number;
  below: number;
  viewport: number;
  /** Nothing is loaded yet */
  empty: boolean;
}): PageSide | undefined {
  if (reader.busy || reader.empty) return;

  const margin = reader.viewport * PREFETCH_SCREENS;
  const older =
    !reader.atStart && reader.failed !== "older" && reader.above <= margin;
  const newer =
    !reader.atEnd && reader.failed !== "newer" && reader.below <= margin;

  if (older && newer) return reader.above <= reader.below ? "older" : "newer";
  if (older) return "older";
  if (newer) return "newer";
}

/**
 * The bar above the message box that leads back to the present
 * @returns What it says, or nothing when it is hidden
 */
export function jumpBar(reader: {
  atEnd: boolean;
  below: number;
  viewport: number;
  /** Messages that arrived while the reader was not at the present */
  unseen: number;
  /** Some of the newest message of the channel is on screen */
  newestVisible: boolean;
}): { kind: "older" | "new"; unseen: number } | undefined {
  if (isAtPresent(reader)) return;
  // the bar floats over the bottom of the list: it must never lie over the
  // newest message, and a reader who sees that message needs no way to it
  if (reader.atEnd && reader.newestVisible) return;
  if (reader.unseen > 0) return { kind: "new", unseen: reader.unseen };
  if (!reader.atEnd || reader.below > reader.viewport) {
    return { kind: "older", unseen: 0 };
  }
}

/**
 * How the view travels a distance: a glide the eye can follow, or a cut
 */
export function travel(
  distance: number,
  viewport: number,
  reducedMotion: boolean,
): "smooth" | "instant" {
  return !reducedMotion && Math.abs(distance) <= viewport * GLIDE_SCREENS
    ? "smooth"
    : "instant";
}

/**
 * The scroll position that shows a row in the middle of the view (its start,
 * when it is taller than the view), in a column-reverse list: 0 is the
 * bottom, positions above it are negative.
 * @param view.rowTop The row's top edge, measured from the top edge of the view
 */
export function scrollTopToShowRow(view: {
  scrollTop: number;
  viewport: number;
  scrollHeight: number;
  rowTop: number;
  rowHeight: number;
}) {
  const shift =
    view.rowHeight > view.viewport - TALL_ROW_MARGIN * 2
      ? view.rowTop - TALL_ROW_MARGIN
      : view.rowTop + view.rowHeight / 2 - view.viewport / 2;
  const highest = -(view.scrollHeight - view.viewport);
  return Math.min(0, Math.max(highest, Math.round(view.scrollTop + shift)));
}

/** Rows kept in the list when the screen does not ask for more */
const BASE_ROWS = 150;

/** Rows in one page (see the controller) */
const PAGE_ROWS = 50;

/**
 * How many rows the list keeps. Rows are asked for while fewer than
 * PREFETCH_SCREENS screens of them are left on a side, so the list must hold
 * that much on both sides of the view, plus the pages that arrive: with
 * fewer, a page added on one side would push out rows the other side asks
 * for again at once, back and forth. A tall screen with short rows needs
 * more than the usual number.
 */
export function rowsToKeep(list: {
  viewport: number;
  /** Height of the loaded rows together */
  rowsHeight: number;
  /** How many rows that is */
  count: number;
}) {
  if (!list.count || !list.rowsHeight || !list.viewport) return BASE_ROWS;
  const rowHeight = list.rowsHeight / list.count;
  const screens = PREFETCH_SCREENS * 2 + 1;
  return Math.max(
    BASE_ROWS,
    Math.ceil((list.viewport * screens) / rowHeight) + PAGE_ROWS * 2,
  );
}
