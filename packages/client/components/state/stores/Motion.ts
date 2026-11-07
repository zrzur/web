import {
  type AreaSettings,
  type MotionArea,
  type MotionMode,
  type MotionPhase,
  type PhaseSettings,
  type ReduceMotion,
  AREA_DEFINITIONS,
  MOTION_MODES,
  cleanAreas,
  defaultAreas,
  isLowPowerDevice,
  motionActive,
  resolveMotion,
} from "@revolt/ui/motion/presets";
import { createSignal } from "solid-js";

import { State } from "..";

import { AbstractStore } from ".";

export type TypeMotion = {
  /**
   * The whole system: off (default), automatic or on
   */
  mode: MotionMode;

  /**
   * Reduce motion: follow the device, always reduce, or never reduce
   */
  reduce: ReduceMotion;

  /**
   * Show separate opening and closing settings
   */
  advanced: boolean;

  /**
   * Settings for each animated part of the app
   */
  areas: Record<MotionArea, AreaSettings>;
};

const REDUCE_VALUES: ReduceMotion[] = ["system", "on", "off"];

/**
 * Animation settings, stored on this device like the theme
 */
export class Motion extends AbstractStore<"motion", TypeMotion> {
  /**
   * Whether the device asks for reduced motion
   */
  private systemReduced;
  private setSystemReduced;

  /**
   * Whether this device is too weak for animations (checked once)
   */
  readonly lowPower =
    typeof navigator !== "undefined" &&
    isLowPowerDevice(navigator as Parameters<typeof isLowPowerDevice>[0]);

  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "motion");

    const query =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    const [get, set] = createSignal(query?.matches ?? false);
    this.systemReduced = get;
    this.setSystemReduced = set;
    query?.addEventListener?.("change", (event) => set(event.matches));
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeMotion {
    return {
      mode: "off",
      reduce: "system",
      advanced: false,
      areas: defaultAreas(),
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeMotion>): TypeMotion {
    return {
      mode: MOTION_MODES.includes(input.mode as MotionMode)
        ? (input.mode as MotionMode)
        : "off",
      reduce: REDUCE_VALUES.includes(input.reduce as ReduceMotion)
        ? (input.reduce as ReduceMotion)
        : "system",
      advanced: typeof input.advanced === "boolean" ? input.advanced : false,
      areas: cleanAreas(input.areas),
    };
  }

  get mode() {
    return this.get().mode;
  }

  setMode(value: MotionMode) {
    this.set("mode", value);
  }

  /**
   * Whether animations play at all right now
   */
  get active() {
    return motionActive(this.get().mode, this.lowPower);
  }

  get reduce() {
    return this.get().reduce;
  }

  setReduce(value: ReduceMotion) {
    this.set("reduce", value);
  }

  /**
   * Whether motion is reduced right now
   */
  get reduced() {
    const value = this.get().reduce;
    return value === "on" || (value === "system" && this.systemReduced());
  }

  /**
   * Whether the device asks for reduced motion
   */
  get deviceReduced() {
    return this.systemReduced();
  }

  get advanced() {
    return this.get().advanced;
  }

  setAdvanced(value: boolean) {
    this.set("advanced", value);
  }

  area(area: MotionArea) {
    return this.get().areas[area];
  }

  setEnabled(area: MotionArea, enabled: boolean) {
    this.set("areas", area, "enabled", enabled);
  }

  /**
   * Change one phase, or both at once in the simple view
   */
  setPhase(
    area: MotionArea,
    phase: MotionPhase | "both",
    patch: Partial<PhaseSettings>,
  ) {
    const phases: MotionPhase[] =
      phase === "both" ? AREA_DEFINITIONS[area].phases : [phase];
    for (const name of phases) {
      this.set("areas", area, name, (value) => ({ ...value, ...patch }));
    }
  }

  /**
   * Put one area, or every area, back to the defaults
   */
  reset(area?: MotionArea) {
    if (area) {
      this.set("areas", area, structuredClone(AREA_DEFINITIONS[area].defaults));
    } else {
      this.set("areas", defaultAreas());
    }
  }

  /**
   * The animation to play for an area and phase, if any
   */
  resolve(area: MotionArea, phase: MotionPhase) {
    if (!this.active) return;
    return resolveMotion(area, phase, this.area(area), this.reduced);
  }
}
