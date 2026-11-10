import { describe, expect, it } from "vitest";

import {
  type InsightsDay,
  FEW,
  barHeights,
  formatDay,
  formatMinutes,
  hasActivity,
  perDay,
  shares,
  viewerTimeZone,
} from "./insightsData";

const day = (values: Partial<InsightsDay>): InsightsDay => ({
  day: "2026-11-10",
  joins: 0,
  leaves: 0,
  members: 0,
  messages: 0,
  active_members: 0,
  voice_minutes: 0,
  ...values,
});

describe("server insights data", () => {
  it("averages a total per day", () => {
    expect(perDay(7, 3)).toBe(2);
    expect(perDay(7, 0)).toBe(0);
  });

  it("draws a hidden small number as a low bar, never as none", () => {
    expect(barHeights([null, 0, 50])).toEqual([FEW, 0, 100]);
  });

  it("scales bars to the busiest day and keeps small days visible", () => {
    expect(barHeights([0, 1, 50, 100])).toEqual([0, 4, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
    expect(barHeights([5, 5])).toEqual([100, 100]);
    expect(barHeights([])).toEqual([]);
  });

  it("draws totals from their lowest day so small changes show", () => {
    expect(barHeights([100, 101, 102], true)).toEqual([20, 60, 100]);
    expect(barHeights([7, 7], true)).toEqual([60, 60]);
  });

  it("knows when nothing was counted", () => {
    expect(hasActivity([day({ members: 40 })])).toBe(false);
    expect(hasActivity([day({ voice_minutes: 1 })])).toBe(true);
    // 1 to 4 people: hidden, but there was activity
    expect(hasActivity([day({ active_members: null })])).toBe(true);
  });

  it("gives shares that never divide by zero", () => {
    expect(shares([1, 1, 2, 0])).toEqual([25, 25, 50, 0]);
    expect(shares([0, 0])).toEqual([0, 0]);
    // a hidden 1 to 4 is a sliver
    expect(shares([null, 10])).toEqual([3, 100]);
  });

  it("labels a day by its own date, whatever the browser's zone", () => {
    expect(formatDay("2026-11-01", "en")).toBe("Nov 1");
    expect(formatDay("2026-11-01", "de")).toBe("1. Nov.");
    expect(formatDay("2026-11-01", "ar")).toMatch(/نوفمبر/);
    expect(formatDay("not a day", "en")).toBe("not a day");
  });

  it("writes voice time in hours and minutes", () => {
    expect(formatMinutes(45, "en")).toBe("45m");
    expect(formatMinutes(120, "en")).toBe("2h");
    expect(formatMinutes(200, "en")).toBe("3h 20m");
  });

  it("sends the viewer's zone and offset east of UTC", () => {
    const zone = viewerTimeZone();
    expect(zone.utc_offset).toBe(-new Date().getTimezoneOffset() || 0);
    expect(typeof zone.time_zone).toBe("string");
  });
});
