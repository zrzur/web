/**
 * solid-dnd-directive animates rows after a drag ("FLIP"): on every change
 * of a zone's options it measures every row with getBoundingClientRect,
 * even when no drag happened, so each channel list that opens forces a
 * layout per category. The rows only need measuring after the zone read
 * their places for a drag (its consider / finalize events). This build
 * step makes the flip wait for such a read; dragging is unchanged.
 */

export const DND_FILE = /\/solid-dnd-directive\/dist\/(source|esm)\/index\.js$/;

const DECLARE = "let flipper = undefined;";
const FLIP = "flipper?.flip(getItems().map(item => item[ID_KEY]));";
const READ = "flipper?.read(getItems().map(item => item[ID_KEY]));";

/** The library's source with the flip waiting for a drag */
export function measureOnlyAfterDrag(code) {
  const reads = code.split(READ).length - 1;
  if (!code.includes(DECLARE) || !code.includes(FLIP) || reads !== 2)
    throw new Error("solid-dnd-directive changed: update scripts/dndFlip.mjs");
  return code
    .replace(DECLARE, `${DECLARE}\n    let flipPending = false;`)
    .replace(
      FLIP,
      `if (flipPending) {\n                flipPending = false;\n                ${FLIP}\n            }`,
    )
    .replaceAll(READ, `flipPending = true;\n            ${READ}`);
}

/** Vite plugin */
export function dndFlip() {
  return {
    name: "zrzur-dnd-flip",
    enforce: "pre",
    transform(code, id) {
      if (!DND_FILE.test(id.replace(/\\/g, "/").split("?")[0])) return;
      return { code: measureOnlyAfterDrag(code), map: null };
    },
  };
}
