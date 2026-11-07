import { useMotion } from "./engine";
import type { MotionArea } from "./presets";

/**
 * Longest stagger between items that appear together, in ms
 */
const STAGGER_MS = 18;
const STAGGER_ITEMS = 8;

/**
 * Animate a list that expands and collapses (like a channel category).
 *
 * Expanding: switch first, then the new items animate in with a small
 * stagger. Collapsing: the leaving items animate out first, then the list
 * switches. Clicking again while it collapses turns the items back.
 */
export function useListToggle(area: MotionArea) {
  const motion = useMotion();
  let closing: Element[] | undefined;

  return (options: {
    open: boolean;
    /**
     * Current items in the list
     */
    items: () => Element[];
    /**
     * Items that stay visible when the list is collapsed
     */
    keep?: (item: Element) => boolean;
    toggle: () => void;
  }) => {
    // reopened while closing: bring the items back, nothing to switch
    if (closing) {
      const items = closing;
      closing = undefined;
      for (const item of items) motion.play(item, area, "enter");
      return;
    }

    if (options.open) {
      const leaving = options.items().filter((item) => !options.keep?.(item));
      if (!leaving.length || !motion.duration(area, "exit")) {
        options.toggle();
        return;
      }

      closing = leaving;
      Promise.all(leaving.map((item) => motion.play(item, area, "exit"))).then(
        () => {
          if (closing !== leaving) return;
          closing = undefined;
          options.toggle();
          // anything still on screen (kept by the list) shows again
          for (const item of leaving) motion.cancel(item);
        },
      );
    } else {
      const before = new Set(options.items());
      options.toggle();
      // the list may render its new rows a moment later; animation frames
      // run before the next paint, so nothing flashes
      requestAnimationFrame(() =>
        options
          .items()
          .filter((item) => !before.has(item))
          .forEach((item, index) =>
            motion.play(item, area, "enter", {
              delay: Math.min(index, STAGGER_ITEMS) * STAGGER_MS,
            }),
          ),
      );
    }
  };
}
