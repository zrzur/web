import { describe, expect, it } from "vitest";

import { PartLoadError } from "../common/lib/lazyPart";

import { windowNeverDrew } from "./windowFailure";

const lost = new TypeError("Failed to fetch dynamically imported module");
const ownPart = {};
const nested = {};
const isOwn = (part: unknown) => part === ownPart;

describe("which failures take a window off the list", () => {
  it("the window's own part: it never drew, so it goes", () => {
    expect(windowNeverDrew(new PartLoadError(lost, ownPart), isOwn)).toBe(true);
  });

  it("a part nested inside an open window: the window stays", () => {
    expect(windowNeverDrew(new PartLoadError(lost, nested), isOwn)).toBe(false);
  });

  it("a bug, not a download: the window stays and the error goes up", () => {
    expect(windowNeverDrew(new RangeError("bug"), isOwn)).toBe(false);
  });
});
