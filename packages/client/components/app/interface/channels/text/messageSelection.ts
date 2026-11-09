import { createRoot, createSignal } from "solid-js";

import { decodeTime } from "ulid";

/**
 * Most messages one bulk delete takes (`OptionsBulkDelete`, max 100 ids)
 */
export const BULK_DELETE_MAX = 100;

/**
 * Oldest message one bulk delete takes (message_bulk_delete.rs: 7 days)
 */
export const BULK_DELETE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Kept free before the age limit, so a message does not cross it while
 * the dialog is open or the request travels
 */
const AGE_MARGIN_MS = 60 * 1000;

/** A selection change and whether the limit stopped it */
export interface SelectionResult {
  ids: Set<string>;
  full: boolean;
}

/**
 * Select or unselect one message; never more than the backend takes
 */
export function toggleSelected(
  ids: ReadonlySet<string>,
  id: string,
): SelectionResult {
  const next = new Set(ids);
  if (next.has(id)) {
    next.delete(id);
    return { ids: next, full: false };
  }
  if (next.size >= BULK_DELETE_MAX) return { ids: next, full: true };
  next.add(id);
  return { ids: next, full: false };
}

/**
 * Shift-click: add every message between the anchor and the target
 * (`ordered` is the channel's messages, oldest first)
 */
export function selectRange(
  ids: ReadonlySet<string>,
  ordered: readonly string[],
  anchor: string | undefined,
  target: string,
): SelectionResult {
  const from = anchor ? ordered.indexOf(anchor) : -1;
  const to = ordered.indexOf(target);
  if (from === -1 || to === -1) return toggleSelected(ids, target);

  const next = new Set(ids);
  const [start, end] = from < to ? [from, to] : [to, from];
  for (let i = start; i <= end; i++) {
    if (next.has(ordered[i])) continue;
    if (next.size >= BULK_DELETE_MAX) return { ids: next, full: true };
    next.add(ordered[i]);
  }
  return { ids: next, full: false };
}

/** When a message was sent, from its id; NaN for an id that is not a ULID */
function sentAt(id: string): number {
  try {
    return decodeTime(id);
  } catch {
    return NaN;
  }
}

/**
 * Split ids into those a bulk delete takes and those too old for it
 */
export function splitByAge(
  ids: readonly string[],
  now: number = Date.now(),
): { deletable: string[]; tooOld: string[] } {
  const deletable: string[] = [];
  const tooOld: string[] = [];
  for (const id of ids) {
    const age = now - sentAt(id);
    if (age < BULK_DELETE_MAX_AGE_MS - AGE_MARGIN_MS) deletable.push(id);
    else tooOld.push(id);
  }
  return { deletable, tooOld };
}

/**
 * "Delete recent messages": the newest `count` messages, optionally only
 * one member's, that a bulk delete still takes
 */
export function pickRecent(
  messages: readonly { id: string; authorId?: string }[],
  count: number,
  authorId: string | undefined,
  now: number = Date.now(),
): string[] {
  const limit = Math.min(count, BULK_DELETE_MAX);
  const candidates = messages
    .filter((message) => !authorId || message.authorId === authorId)
    .map((message) => message.id);
  const { deletable } = splitByAge(candidates, now);
  return deletable.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, limit);
}

/** The selection mode of the open channel: one channel at a time */
interface SelectionState {
  channelId: string;
  ids: Set<string>;
  anchor?: string;
  /** The last change was stopped by the limit */
  full: boolean;
}

const store = createRoot(() => {
  const [selection, setSelection] = createSignal<SelectionState>();
  return { selection, setSelection };
});

/** Current selection, if a channel is in selection mode */
export const messageSelection = store.selection;

/** Whether a channel is in selection mode */
export function isSelecting(channelId: string | undefined) {
  return !!channelId && store.selection()?.channelId === channelId;
}

/** Whether a message is selected */
export function isMessageSelected(channelId: string, messageId: string) {
  const current = store.selection();
  return current?.channelId === channelId && current.ids.has(messageId);
}

/** Start selection mode in a channel, optionally with a first message */
export function startSelection(channelId: string, messageId?: string) {
  store.setSelection({
    channelId,
    ids: new Set(messageId ? [messageId] : []),
    anchor: messageId,
    full: false,
  });
}

/** Leave selection mode */
export function cancelSelection() {
  store.setSelection(undefined);
}

/**
 * A click on a message in selection mode
 * @param ordered The channel's loaded messages, oldest first (for shift)
 */
export function clickMessage(
  channelId: string,
  messageId: string,
  shift: boolean,
  ordered: () => string[],
) {
  const current = store.selection();
  if (current?.channelId !== channelId) return;
  const result = shift
    ? selectRange(current.ids, ordered(), current.anchor, messageId)
    : toggleSelected(current.ids, messageId);
  store.setSelection({
    channelId,
    ids: result.ids,
    anchor: messageId,
    full: result.full,
  });
}
