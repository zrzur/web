import { useState } from "@revolt/state";

import {
  type MotionArea,
  type MotionPhase,
  type ResolvedMotion,
  backdropKeyframes,
  buildKeyframes,
} from "./presets";

/**
 * Something that can resolve the animation for an area (the Motion store)
 */
export type MotionSource = {
  resolve(area: MotionArea, phase: MotionPhase): ResolvedMotion | undefined;
};

type Running = {
  animation: Animation;
  phase: MotionPhase;
};

/**
 * The latest animation on each element, so a new one can take
 * over instead of stacking on top
 */
const running = new WeakMap<Element, Running>();

export type PlayOptions = {
  /**
   * Use the backdrop keyframes (opacity and frosted glass)
   */
  backdrop?: boolean;
  /**
   * Phone sheet: anything that moves rises from the bottom edge instead
   */
  sheet?: boolean;
  /**
   * Collapse the element's height at the end of an exit, so the items
   * around it close the gap smoothly (used for deleted messages)
   */
  collapse?: boolean;
  /**
   * Wait this long before starting, in ms (for small staggers)
   */
  delay?: number;
};

const isRtl = () =>
  typeof document !== "undefined" &&
  (document.documentElement.dir === "rtl" ||
    document.body?.dir === "rtl" ||
    getComputedStyle(document.documentElement).direction === "rtl");

/**
 * Stop whatever animation is running on an element
 */
export function cancelMotion(element: Element) {
  const current = running.get(element);
  if (current) {
    current.animation.cancel();
    running.delete(element);
  }
  (element as HTMLElement).style?.removeProperty("pointer-events");
}

/**
 * Play the enter or exit animation of an area on an element.
 *
 * - Uses the Web Animations API on transform, opacity and filter only.
 * - An exit that interrupts an enter (or the other way round) reverses it
 *   from where it is, so quick open/close never jumps.
 * - Exiting elements ignore the pointer, so input never waits on motion.
 *
 * Resolves when the animation is done (at once when nothing plays).
 */
export function playMotion(
  source: MotionSource,
  element: Element | undefined | null,
  area: MotionArea,
  phase: MotionPhase,
  options: PlayOptions = {},
): Promise<void> {
  if (!element || typeof element.animate !== "function") {
    return Promise.resolve();
  }

  const style = (element as HTMLElement).style;
  // Phones: a sheet rises from the bottom edge whatever the Animations
  // setting says (it is off by default, and a sheet that just appears in
  // its place was read as broken; owner, 2026-11-17). Only the system's
  // "reduce motion" keeps it still.
  const motion =
    options.sheet && !prefersStill()
      ? (source.resolve(area, phase) ?? sheetMotion(phase))
      : source.resolve(area, phase);
  const current = running.get(element);

  if (!motion) {
    cancelMotion(element);
    return Promise.resolve();
  }

  if (phase === "exit") style?.setProperty("pointer-events", "none");
  else style?.removeProperty("pointer-events");

  // take over a running animation in the other direction by reversing it
  if (
    current &&
    current.phase !== phase &&
    current.animation.playState === "running" &&
    !options.collapse
  ) {
    current.animation.reverse();
    current.phase = phase;
    return settle(current.animation);
  }

  current?.animation.cancel();

  let keyframes = options.backdrop
    ? backdropKeyframes(motion, phase)
    : options.sheet && !prefersStill()
      ? sheetKeyframes(phase)
      : buildKeyframes(motion, phase, isRtl());

  if (options.collapse && phase === "exit") {
    const height = (element as HTMLElement).offsetHeight;
    keyframes = [
      { ...keyframes[0], height: `${height}px`, offset: 0 },
      { ...keyframes[1], height: `${height}px`, offset: 0.6 },
      { ...keyframes[1], height: "0px", offset: 1 },
    ];
  }

  const animation = element.animate(keyframes, {
    duration: motion.duration,
    easing: motion.easing,
    delay: options.delay ?? 0,
    // enter: hidden until it starts; exit: stay hidden until removed
    fill:
      phase === "enter"
        ? options.backdrop
          ? "both"
          : "backwards"
        : "forwards",
  });

  running.set(element, { animation, phase });
  return settle(animation);
}

/**
 * Phones: whatever opens rises from the bottom edge of the screen, its whole
 * height, and leaves the same way (owner, 2026-11-17: every dialog and sheet,
 * without exception; it used to fade in 120 px under its place, which read
 * as appearing in place). The chosen motion style does not change this; with
 * motion switched off nothing is animated at all (see above).
 */
/** The system asks for less motion */
const prefersStill = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** How a phone sheet moves when the Animations setting gives nothing */
export const SHEET_MS = { enter: 220, exit: 160 } as const;
const sheetMotion = (phase: MotionPhase) => ({
  style: "rise" as const,
  duration: SHEET_MS[phase],
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  direction: "up" as const,
  origin: "50% 100%",
});

function sheetKeyframes(phase: MotionPhase) {
  const frames = [
    { transform: "translateY(100%)", opacity: 1 },
    { transform: "translateY(0)", opacity: 1 },
  ];
  return phase === "enter" ? frames : frames.reverse();
}

/**
 * Resolve when an animation ends. Finished animations stay in the map: an
 * exit keeps its element hidden (fill forwards) until the next animation
 * on that element cancels it.
 */
function settle(animation: Animation) {
  return animation.finished.then(
    () => undefined,
    // cancelled: another animation took over
    () => undefined,
  );
}

/**
 * Animation helpers bound to the app's motion settings
 */
export function useMotion() {
  const state = useState();

  return {
    play: (
      element: Element | undefined | null,
      area: MotionArea,
      phase: MotionPhase,
      options?: PlayOptions,
    ) => playMotion(state.motion, element, area, phase, options),
    /**
     * Total time of an animation in ms, 0 when nothing plays
     */
    duration: (area: MotionArea, phase: MotionPhase) =>
      state.motion.resolve(area, phase)?.duration ?? 0,
    cancel: cancelMotion,
  };
}
