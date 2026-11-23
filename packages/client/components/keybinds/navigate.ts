/**
 * Moving through a list with a shortcut (channels, unread channels): the
 * next item in one direction that matches, wrapping around the ends, never
 * the item you are on.
 */

/**
 * Index of the next matching item, or -1 when nothing else matches
 * @param length How many items
 * @param from Index of the current item (-1 when it is not in the list)
 * @param step 1 = down, -1 = up
 * @param matches Whether the item at an index qualifies
 */
export function nextIndex(
  length: number,
  from: number,
  step: 1 | -1,
  matches: (index: number) => boolean = () => true,
): number {
  if (length <= 0) return -1;
  // not in the list: down starts at the top, up at the bottom
  const start = from < 0 ? (step === 1 ? -1 : length) : from;
  for (let n = 1; n <= length; n++) {
    const index = (((start + step * n) % length) + length) % length;
    if (index === from) break;
    if (matches(index)) return index;
  }
  return -1;
}
