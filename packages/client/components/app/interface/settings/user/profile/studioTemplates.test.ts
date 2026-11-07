import { describe, expect, it } from "vitest";

import {
  decorationAvatarRadius,
  plateGuide,
  plateMarks,
  plateVisibility,
} from "./studioTemplates";

describe("the nameplate template", () => {
  const guide = plateGuide();

  it("crops what the member row crops, the same at top and bottom", () => {
    expect(guide.crop).toBeCloseTo(15.95, 1);
    expect(guide.bottom - guide.top).toBeCloseTo(160.1, 1);
    expect(guide.top + guide.bottom).toBeCloseTo(192);
  });

  it("puts the avatar where the row does, at both ends", () => {
    expect(guide.radius * 2).toBeCloseTo(134.8, 1);
    expect(guide.avatar.ltr).toBeCloseTo(101.1, 1);
    expect(guide.avatar.rtl).toBeCloseTo(922.9, 1);
    expect(guide.avatar.ltr + guide.avatar.rtl).toBeCloseTo(1024);
  });

  it("starts the name after the avatar, mirrored", () => {
    expect(guide.name.ltr.from).toBeCloseTo(202.3, 1);
    expect(guide.name.rtl.to).toBeCloseTo(821.7, 1);
    expect(guide.name.height).toBeCloseTo(75.9, 1);
  });

  it("fades as the row's mask does", () => {
    expect(plateVisibility(0, "ltr")).toBe(0);
    expect(plateVisibility(307.2, "ltr")).toBeCloseTo(0.55);
    expect(plateVisibility(665.6, "ltr")).toBe(1);
    expect(plateVisibility(1024, "ltr")).toBe(1);
  });

  it("mirrors the fade in right-to-left languages", () => {
    for (const x of [0, 100, 307, 512, 800, 1024]) {
      expect(plateVisibility(x, "rtl")).toBeCloseTo(
        plateVisibility(1024 - x, "ltr"),
      );
    }
  });

  it("has no part that is full in both directions", () => {
    expect(guide.full.rtl).toBeLessThan(guide.full.ltr);
    const best = Math.max(
      ...Array.from({ length: 1025 }, (_, x) =>
        Math.min(plateVisibility(x, "ltr"), plateVisibility(x, "rtl")),
      ),
    );
    expect(best).toBeCloseTo(0.807, 2);
  });

  it("gives the studio marks in the same places", () => {
    expect(plateMarks()).toEqual({
      crop: "8.30%",
      avatarInset: "3.29%",
      avatarSize: "13.17%",
      nameInset: "19.75%",
      nameSize: "22.22%",
      nameEdge: "30.25%",
    });
  });
});

describe("the decoration template", () => {
  it("draws the avatar at two thirds of the art", () => {
    expect((decorationAvatarRadius() * 2) / 1024).toBeCloseTo(2 / 3);
  });
});
