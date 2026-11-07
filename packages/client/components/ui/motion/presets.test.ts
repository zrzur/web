import { describe, expect, it } from "vitest";

import {
  AREA_DEFINITIONS,
  EASING_CURVES,
  MAX_DURATION,
  MOTION_AREAS,
  REDUCED_MAX_DURATION,
  buildKeyframes,
  cleanAreas,
  defaultAreas,
  hiddenPose,
  isLowPowerDevice,
  motionActive,
  resolveMotion,
} from "./presets";

describe("animation mode", () => {
  it("treats weak or data-saving devices as low power", () => {
    expect(isLowPowerDevice({ hardwareConcurrency: 2 })).toBe(true);
    expect(isLowPowerDevice({ deviceMemory: 2 })).toBe(true);
    expect(isLowPowerDevice({ connection: { saveData: true } })).toBe(true);
    expect(isLowPowerDevice({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(
      false,
    );
    // browsers that report nothing are not punished
    expect(isLowPowerDevice({})).toBe(false);
    expect(isLowPowerDevice(undefined)).toBe(false);
  });

  it("plays only when on, or automatic on a strong device", () => {
    expect(motionActive("off", false)).toBe(false);
    expect(motionActive("auto", false)).toBe(true);
    expect(motionActive("auto", true)).toBe(false);
    expect(motionActive("on", true)).toBe(true);
  });
});

describe("motion presets", () => {
  it("has defaults for every area that survive cleaning", () => {
    const defaults = defaultAreas();
    expect(Object.keys(defaults).sort()).toEqual([...MOTION_AREAS].sort());
    expect(cleanAreas(defaults)).toEqual(defaults);
  });

  it("cleans bad stored values back to defaults", () => {
    const cleaned = cleanAreas({
      popouts: {
        enabled: "yes",
        enter: {
          style: "wobble",
          duration: 99999,
          easing: "bouncy",
          direction: "sideways",
        },
      },
      backdrop: { enter: { style: "slide" } },
    } as unknown as Parameters<typeof cleanAreas>[0]);
    const defaults = AREA_DEFINITIONS.popouts.defaults;
    expect(cleaned.popouts.enabled).toBe(defaults.enabled);
    expect(cleaned.popouts.enter.style).toBe(defaults.enter.style);
    expect(cleaned.popouts.enter.duration).toBe(MAX_DURATION);
    expect(cleaned.popouts.enter.easing).toBe("bouncy");
    expect(cleaned.popouts.enter.direction).toBe(defaults.enter.direction);
    // the backdrop only offers none, fade and blur
    expect(cleaned.backdrop.enter.style).toBe(
      AREA_DEFINITIONS.backdrop.defaults.enter.style,
    );
  });

  it("plays nothing when an area is off, set to none or has no exit", () => {
    const areas = defaultAreas();
    expect(
      resolveMotion(
        "popouts",
        "enter",
        { ...areas.popouts, enabled: false },
        false,
      ),
    ).toBeUndefined();
    expect(
      resolveMotion(
        "popouts",
        "enter",
        { ...areas.popouts, enter: { ...areas.popouts.enter, style: "none" } },
        false,
      ),
    ).toBeUndefined();
    // page switches only animate the new page in
    expect(
      resolveMotion("channels", "exit", areas.channels, false),
    ).toBeUndefined();
  });

  it("turns reduced motion into a short fade", () => {
    const areas = defaultAreas();
    areas.modals.enter = { ...areas.modals.enter, style: "pop", duration: 600 };
    const motion = resolveMotion("modals", "enter", areas.modals, true)!;
    expect(motion.style).toBe("fade");
    expect(motion.duration).toBe(REDUCED_MAX_DURATION);
    expect(motion.easing).toBe(EASING_CURVES.linear);
  });

  it("mirrors start and end in right-to-left layouts", () => {
    expect(hiddenPose("slide", "start", false).x).toBeLessThan(0);
    expect(hiddenPose("slide", "start", true).x).toBeGreaterThan(0);
    expect(hiddenPose("slide", "end", true).x).toBeLessThan(0);
    expect(hiddenPose("slide", "up", true).y).toBeGreaterThan(0);
  });

  it("builds enter frames from hidden to shown and exit the other way", () => {
    const motion = resolveMotion(
      "popouts",
      "enter",
      defaultAreas().popouts,
      false,
    )!;
    const enter = buildKeyframes(motion, "enter", false);
    const exit = buildKeyframes(motion, "exit", false);
    expect(enter[0].opacity).toBe(0);
    expect(enter[1].opacity).toBe(1);
    expect(exit[0]).toEqual(enter[1]);
    expect(exit[1]).toEqual(enter[0]);
    // only compositor-friendly properties
    for (const frame of enter) {
      expect(Object.keys(frame).sort()).toEqual(
        ["opacity", "transform", "transformOrigin"].sort(),
      );
    }
  });

  it("clears the blur at the shown end", () => {
    const areas = defaultAreas();
    areas.settings.enter.style = "blur";
    const motion = resolveMotion("settings", "enter", areas.settings, false)!;
    const [from, to] = buildKeyframes(motion, "enter", false);
    expect(from.filter).toBe("blur(10px)");
    expect(to.filter).toBe("blur(0px)");
  });
});
