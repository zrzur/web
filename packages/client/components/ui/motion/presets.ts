/**
 * Zrzur motion presets: the parts of the app that animate, the styles they
 * can use and how a style turns into keyframes. Pure data and functions, no
 * DOM access, so it can be unit tested.
 */

/**
 * Parts of the app with their own animation settings
 */
export const MOTION_AREAS = [
  "servers",
  "channels",
  "settings",
  "popouts",
  "contextMenus",
  "tooltips",
  "messages",
  "channelList",
  "modals",
  "backdrop",
  "panels",
] as const;

export type MotionArea = (typeof MOTION_AREAS)[number];

export type MotionPhase = "enter" | "exit";

/**
 * Animation styles
 *
 * none: no animation
 * fade: opacity only
 * slide: moves in from one side
 * scale: grows from slightly smaller
 * blur: comes into focus
 * rise: lifts up a little while it grows
 * glide: short soft move with a light blur
 * pop: grows from small, best with the bouncy curve
 * unfold: opens from its top edge like a sheet of paper
 */
export const MOTION_STYLES = [
  "none",
  "fade",
  "slide",
  "scale",
  "blur",
  "rise",
  "glide",
  "pop",
  "unfold",
] as const;

export type MotionStyle = (typeof MOTION_STYLES)[number];

/**
 * Styles that move along a chosen direction
 */
export const DIRECTIONAL_STYLES: MotionStyle[] = ["slide", "glide"];

export const MOTION_DIRECTIONS = ["up", "down", "start", "end"] as const;

export type MotionDirection = (typeof MOTION_DIRECTIONS)[number];

export const MOTION_EASINGS = [
  "smooth",
  "settle",
  "accelerate",
  "even",
  "bouncy",
  "linear",
] as const;

export type MotionEasing = (typeof MOTION_EASINGS)[number];

/**
 * CSS timing functions for each easing
 */
export const EASING_CURVES: Record<MotionEasing, string> = {
  smooth: "cubic-bezier(0.2, 0, 0, 1)",
  settle: "cubic-bezier(0, 0, 0.2, 1)",
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",
  even: "cubic-bezier(0.65, 0, 0.35, 1)",
  bouncy: "cubic-bezier(0.3, 1.45, 0.55, 1)",
  linear: "linear",
};

export const MIN_DURATION = 0;
export const MAX_DURATION = 800;

/**
 * Longest animation while motion is reduced
 */
export const REDUCED_MAX_DURATION = 120;

export type PhaseSettings = {
  style: MotionStyle;
  duration: number;
  easing: MotionEasing;
  direction: MotionDirection;
};

export type AreaSettings = {
  enabled: boolean;
  enter: PhaseSettings;
  exit: PhaseSettings;
};

export type ReduceMotion = "system" | "on" | "off";

/**
 * The whole animation system: off (default), automatic (on when the device
 * is strong enough), or on
 */
export const MOTION_MODES = ["off", "auto", "on"] as const;

export type MotionMode = (typeof MOTION_MODES)[number];

/**
 * What the browser tells us about the device. All optional: browsers that
 * don't report a value are not treated as weak.
 */
export type DeviceHints = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/**
 * A device is too weak for animations when it has fewer than 4 CPU cores,
 * less than 4 GB of memory, or the user turned on data saving.
 */
export function isLowPowerDevice(hints: DeviceHints | undefined): boolean {
  if (!hints) return false;
  return (
    !!hints.connection?.saveData ||
    (typeof hints.deviceMemory === "number" && hints.deviceMemory < 4) ||
    (typeof hints.hardwareConcurrency === "number" &&
      hints.hardwareConcurrency < 4)
  );
}

/**
 * Whether animations play for a mode on this device
 */
export function motionActive(mode: MotionMode, lowPower: boolean) {
  return mode === "on" || (mode === "auto" && !lowPower);
}

type AreaDefinition = {
  /**
   * Phases this area can animate. Page switches only animate the new page in.
   */
  phases: MotionPhase[];
  /**
   * Styles offered for this area
   */
  styles: MotionStyle[];
  /**
   * Point the element grows from
   */
  origin: string;
  defaults: AreaSettings;
};

const phase = (
  style: MotionStyle,
  duration: number,
  easing: MotionEasing,
  direction: MotionDirection = "up",
): PhaseSettings => ({ style, duration, easing, direction });

const BOTH: MotionPhase[] = ["enter", "exit"];
const ENTER: MotionPhase[] = ["enter"];
const ALL_STYLES = [...MOTION_STYLES];

export const AREA_DEFINITIONS: Record<MotionArea, AreaDefinition> = {
  servers: {
    phases: ENTER,
    styles: ALL_STYLES,
    origin: "50% 0",
    defaults: {
      enabled: true,
      enter: phase("rise", 200, "smooth"),
      exit: phase("fade", 120, "accelerate"),
    },
  },
  channels: {
    phases: ENTER,
    styles: ALL_STYLES,
    origin: "50% 0",
    defaults: {
      enabled: true,
      enter: phase("fade", 140, "settle"),
      exit: phase("fade", 100, "accelerate"),
    },
  },
  settings: {
    phases: ENTER,
    styles: ALL_STYLES,
    origin: "50% 0",
    defaults: {
      enabled: true,
      enter: phase("glide", 180, "smooth", "up"),
      exit: phase("fade", 100, "accelerate"),
    },
  },
  popouts: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "0 0",
    defaults: {
      enabled: true,
      enter: phase("scale", 150, "smooth"),
      exit: phase("fade", 100, "accelerate"),
    },
  },
  contextMenus: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "0 0",
    defaults: {
      enabled: true,
      // menus appear as before: a quick fade, nothing unfolding
      enter: phase("fade", 100, "smooth"),
      exit: phase("fade", 90, "accelerate"),
    },
  },
  tooltips: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "50% 100%",
    defaults: {
      enabled: true,
      enter: phase("rise", 110, "settle"),
      exit: phase("fade", 80, "accelerate"),
    },
  },
  messages: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "0 100%",
    defaults: {
      enabled: true,
      enter: phase("rise", 180, "smooth"),
      exit: phase("fade", 160, "accelerate"),
    },
  },
  channelList: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "0 0",
    defaults: {
      enabled: true,
      enter: phase("slide", 150, "smooth", "down"),
      exit: phase("fade", 110, "accelerate"),
    },
  },
  modals: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "50% 50%",
    defaults: {
      enabled: true,
      enter: phase("rise", 180, "smooth"),
      exit: phase("scale", 120, "accelerate"),
    },
  },
  backdrop: {
    phases: BOTH,
    styles: ["none", "fade", "blur"],
    origin: "50% 50%",
    defaults: {
      enabled: true,
      enter: phase("fade", 160, "settle"),
      exit: phase("fade", 140, "accelerate"),
    },
  },
  panels: {
    phases: BOTH,
    styles: ALL_STYLES,
    origin: "100% 0",
    defaults: {
      enabled: true,
      enter: phase("slide", 190, "smooth", "end"),
      exit: phase("slide", 140, "accelerate", "end"),
    },
  },
};

/**
 * Default settings for every area
 */
export function defaultAreas(): Record<MotionArea, AreaSettings> {
  return Object.fromEntries(
    MOTION_AREAS.map((area) => [
      area,
      structuredClone(AREA_DEFINITIONS[area].defaults),
    ]),
  ) as Record<MotionArea, AreaSettings>;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown) =>
  list.includes(value as T) ? (value as T) : undefined;

/**
 * Clean one phase from storage, falling back to the given defaults
 */
export function cleanPhase(
  input: Partial<PhaseSettings> | undefined,
  fallback: PhaseSettings,
  styles: MotionStyle[] = ALL_STYLES,
): PhaseSettings {
  const duration = Number(input?.duration);
  return {
    style: oneOf(styles, input?.style) ?? fallback.style,
    duration: Number.isFinite(duration)
      ? Math.round(Math.min(MAX_DURATION, Math.max(MIN_DURATION, duration)))
      : fallback.duration,
    easing: oneOf(MOTION_EASINGS, input?.easing) ?? fallback.easing,
    direction: oneOf(MOTION_DIRECTIONS, input?.direction) ?? fallback.direction,
  };
}

/**
 * Clean every area from storage
 */
export function cleanAreas(
  input: Partial<Record<MotionArea, Partial<AreaSettings>>> | undefined,
): Record<MotionArea, AreaSettings> {
  return Object.fromEntries(
    MOTION_AREAS.map((area) => {
      const { defaults, styles } = AREA_DEFINITIONS[area];
      const value = input?.[area];
      return [
        area,
        {
          enabled:
            typeof value?.enabled === "boolean"
              ? value.enabled
              : defaults.enabled,
          enter: cleanPhase(value?.enter, defaults.enter, styles),
          exit: cleanPhase(value?.exit, defaults.exit, styles),
        },
      ];
    }),
  ) as Record<MotionArea, AreaSettings>;
}

/**
 * What an animation actually plays, after on/off and reduced motion
 */
export type ResolvedMotion = {
  style: MotionStyle;
  duration: number;
  easing: string;
  direction: MotionDirection;
  origin: string;
};

/**
 * Resolve the animation for one area and phase.
 * Returns undefined when nothing should play.
 */
export function resolveMotion(
  area: MotionArea,
  phaseName: MotionPhase,
  settings: AreaSettings,
  reduced: boolean,
): ResolvedMotion | undefined {
  const definition = AREA_DEFINITIONS[area];
  if (!settings.enabled || !definition.phases.includes(phaseName)) return;

  const value = settings[phaseName];
  if (value.style === "none" || value.duration <= 0) return;

  // reduced motion: nothing moves or zooms, short fades stay so changes
  // are still visible
  if (reduced) {
    return {
      style: "fade",
      duration: Math.min(value.duration, REDUCED_MAX_DURATION),
      easing: EASING_CURVES.linear,
      direction: value.direction,
      origin: definition.origin,
    };
  }

  return {
    style: value.style,
    duration: value.duration,
    easing: EASING_CURVES[value.easing],
    direction: value.direction,
    origin: definition.origin,
  };
}

/**
 * The hidden end of an animation
 */
export type MotionPose = {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  scaleY?: number;
  blur?: number;
};

/**
 * Offset in px for a direction. "start" and "end" follow reading direction.
 */
function along(direction: MotionDirection, distance: number, rtl: boolean) {
  switch (direction) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "start":
      return { x: rtl ? distance : -distance };
    case "end":
      return { x: rtl ? -distance : distance };
  }
}

/**
 * The hidden pose for a style: where an element comes from on enter and
 * goes to on exit
 */
export function hiddenPose(
  style: MotionStyle,
  direction: MotionDirection,
  rtl: boolean,
): MotionPose {
  switch (style) {
    case "none":
      return {};
    case "fade":
      return { opacity: 0 };
    case "slide":
      return { opacity: 0, ...along(direction, 24, rtl) };
    case "scale":
      return { opacity: 0, scale: 0.94 };
    case "blur":
      return { opacity: 0, blur: 10 };
    case "rise":
      return { opacity: 0, y: 8, scale: 0.98 };
    case "glide":
      return { opacity: 0, blur: 3, ...along(direction, 12, rtl) };
    case "pop":
      return { opacity: 0, scale: 0.82 };
    case "unfold":
      return { opacity: 0, scaleY: 0.72 };
  }
}

/**
 * Turn a pose into a WAAPI keyframe. Only transform, opacity and filter
 * change, so nothing triggers layout.
 */
export function poseToKeyframe(pose: MotionPose, origin: string): Keyframe {
  const transform = [
    `translate(${pose.x ?? 0}px, ${pose.y ?? 0}px)`,
    `scale(${pose.scale ?? 1}, ${(pose.scale ?? 1) * (pose.scaleY ?? 1)})`,
  ].join(" ");

  const frame: Keyframe = {
    opacity: pose.opacity ?? 1,
    transform,
    transformOrigin: origin,
  };
  if (pose.blur !== undefined) frame.filter = `blur(${pose.blur}px)`;
  return frame;
}

/**
 * Keyframes for one phase
 */
export function buildKeyframes(
  motion: ResolvedMotion,
  phaseName: MotionPhase,
  rtl: boolean,
): Keyframe[] {
  const hidden = hiddenPose(motion.style, motion.direction, rtl);
  const shown: MotionPose = hidden.blur !== undefined ? { blur: 0 } : {};
  const frames = [
    poseToKeyframe(hidden, motion.origin),
    poseToKeyframe(shown, motion.origin),
  ];
  return phaseName === "enter" ? frames : frames.reverse();
}

/**
 * Keyframes for the dimmed backdrop behind dialogs. The blur style frosts
 * the page instead of blurring the backdrop itself.
 */
export function backdropKeyframes(
  motion: ResolvedMotion,
  phaseName: MotionPhase,
): Keyframe[] {
  const frames: Keyframe[] =
    motion.style === "blur"
      ? [
          { opacity: 0, backdropFilter: "blur(0px)" },
          { opacity: 1, backdropFilter: "blur(6px)" },
        ]
      : [{ opacity: 0 }, { opacity: 1 }];
  return phaseName === "enter" ? frames : frames.reverse();
}
