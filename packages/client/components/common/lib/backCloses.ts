import { type Accessor, createEffect, on, onCleanup } from "solid-js";

/**
 * Phones: Back closes what is open on top of the page (a sheet, a dialog,
 * the settings) and goes nowhere.
 *
 * Nothing that opens on top of a page used to be known to the browser's
 * history, so Back (in an installed app the only way back) left the page
 * under it: from the settings it went to the lists, and once more out of
 * the app (owner, 2026-11-18). Now each thing that opens puts one entry of
 * its own in the history, at the same address:
 *
 * - Back takes that entry away, and the thing closes.
 * - Closed any other way (its own button, a tap outside, a pull down, a row
 *   in it that leads somewhere), its entry is not taken away: stepping the
 *   history back from code is asynchronous, and when the same press also
 *   opened a page, that step took the new page away again (Join call closed
 *   the room's sheet and never reached the call). The entry is marked as
 *   spent instead, and:
 *   - the next thing that opens uses it again, so they do not pile up;
 *   - a Back that starts on a spent entry, or lands on one, goes one step
 *     further, so no Back press does nothing.
 *
 * Wide screens are left alone: a window there has its own close button.
 */

const OPEN = "zSheet";
const SPENT = "zSpent";

type Entry = { id: number; close: () => void };

/** what is open, the topmost last */
const stack: Entry[] = [];
let next = 1;
/** the current history entry is a spent one of ours */
let onSpent = false;
/** a step this module asked for: its popstate is only looked at for more spent entries */
let stepping = false;
let installed = false;

const state = () => (window.history.state ?? {}) as Record<string, unknown>;
const marked = () => state()[OPEN] as number | undefined;

/** One step further back, noted so its popstate is not read as a press */
function stepBack() {
  stepping = true;
  window.history.back();
}

function onPop() {
  const wasSpent = onSpent;
  const asked = stepping;
  onSpent = false;
  stepping = false;

  const top = stack[stack.length - 1];
  // Back took the topmost thing's entry away: close it
  if (top && !asked && marked() !== top.id) {
    stack.pop();
    top.close();
    return;
  }
  if (top) return;
  // nothing is open: an entry of ours met on the way is stepped over, and
  // so is the page under a spent entry Back was pressed on (same address)
  if (state()[SPENT] !== undefined || marked() !== undefined) {
    stepBack();
  } else if (wasSpent && !asked) {
    stepBack();
  }
}

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", onPop);
  // any new page above a spent entry: we are no longer on it
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args) => {
    onSpent = false;
    push(...args);
  };
}

/** Is this a phone (the layout where pages and sheets share the screen)? */
const phone = () => window.matchMedia("(max-width: 600px)").matches;

/**
 * While `open()` is true on a phone, Back closes it instead of leaving the
 * page.
 * @param open Whether the thing is on screen
 * @param close Close it (called once, when Back is pressed)
 */
export function backCloses(open: Accessor<boolean>, close: () => void) {
  install();
  let mine: Entry | undefined;

  const leave = () => {
    const entry = mine;
    mine = undefined;
    if (!entry) return;
    const at = stack.indexOf(entry);
    // already taken off by Back
    if (at < 0) return;
    stack.splice(at, 1);
    // closed by other means while its entry is the current one: spend it
    if (marked() === entry.id) {
      const { [OPEN]: _open, ...rest } = state();
      void _open;
      window.history.replaceState({ ...rest, [SPENT]: entry.id }, "");
      onSpent = true;
    }
  };

  createEffect(
    on(open, (shown) => {
      if (shown && !mine && phone()) {
        mine = { id: next++, close };
        stack.push(mine);
        if (onSpent && state()[SPENT] !== undefined) {
          // a spent entry is under us: use it again
          const { [SPENT]: _spent, ...rest } = state();
          void _spent;
          window.history.replaceState({ ...rest, [OPEN]: mine.id }, "");
          onSpent = false;
        } else {
          window.history.pushState({ ...state(), [OPEN]: mine.id }, "");
        }
      } else if (!shown) {
        leave();
      }
    }),
  );
  onCleanup(leave);
}

/** For tests: forget everything */
export function resetBackCloses() {
  stack.length = 0;
  onSpent = false;
  stepping = false;
}
