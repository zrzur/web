import { describe, expect, it } from "vitest";

import { designSlug, isDesignSlug, parseDesignSlug } from "./designSlug";

describe("design addresses", () => {
  it("reads built-in designs by kind and id", () => {
    expect(parseDesignSlug("look-night-glow")).toEqual({
      kind: "look",
      id: "night-glow",
    });
    expect(parseDesignSlug("decoration-flames")).toEqual({
      kind: "decoration",
      id: "flames",
    });
    expect(parseDesignSlug("colours-Sunset")).toEqual({
      kind: "colours",
      id: "Sunset",
    });
  });

  it("reads community designs by their id", () => {
    expect(parseDesignSlug("01JC3V9X8Q2W5E7R4T6Y1Z0P9A")).toEqual({
      kind: "community",
      id: "01JC3V9X8Q2W5E7R4T6Y1Z0P9A",
    });
  });

  it("leaves the Designs pages alone", () => {
    for (const page of [
      "looks",
      "decorations",
      "nameplates",
      "creators",
      "creator",
      "favourites",
      "studio",
      "community",
    ])
      expect(isDesignSlug(page)).toBe(false);
    expect(isDesignSlug("other-thing")).toBe(false);
    expect(isDesignSlug("look-")).toBe(false);
  });

  it("writes the same address back", () => {
    for (const slug of ["look-ember", "nameplate-aurora"])
      expect(designSlug(parseDesignSlug(slug)!)).toBe(slug);
  });
});
