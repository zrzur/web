import { describe, expect, it } from "vitest";

import {
  addMonths,
  atMinutes,
  dateFormats,
  hour12From,
  monthGrid,
  roundUp,
  timeSlots,
  weekStartFor,
} from "./dateTime";

describe("date and time picker arithmetic", () => {
  it("starts the week where the language is spoken", () => {
    expect(weekStartFor("ar")).toBe(6);
    expect(weekStartFor("en")).toBe(0);
    expect(weekStartFor("en-US")).toBe(0);
    expect(weekStartFor("zh-Hans")).toBe(0);
    expect(weekStartFor("de")).toBe(1);
    expect(weekStartFor("ru")).toBe(1);
  });

  it("shows six full weeks starting on the week's first day", () => {
    // December 2026 starts on a Tuesday
    const monday = monthGrid(2026, 11, 1);
    expect(monday).toHaveLength(42);
    expect(monday[0].getDay()).toBe(1);
    expect(monday[0].getDate()).toBe(30); // 30 November
    expect(monday[1].getDate()).toBe(1);

    const saturday = monthGrid(2026, 11, 6);
    expect(saturday[0].getDay()).toBe(6);
    expect(saturday[3].getDate()).toBe(1);

    // a month starting on the first day of the week has no leading days
    const sunday = monthGrid(2026, 10, 0); // 1 November 2026 is a Sunday
    expect(sunday[0].getDate()).toBe(1);
  });

  it("moves by months without spilling into the next one", () => {
    const end = new Date(2026, 0, 31, 18, 30);
    const next = addMonths(end, 1);
    expect([next.getMonth(), next.getDate()]).toEqual([1, 28]);
    expect([next.getHours(), next.getMinutes()]).toEqual([18, 30]);
    const back = addMonths(new Date(2026, 2, 15), -3);
    expect([back.getFullYear(), back.getMonth()]).toEqual([2025, 11]);
  });

  it("rounds up to the next quarter hour, across midnight too", () => {
    expect(roundUp(new Date(2026, 5, 1, 10, 7)).getMinutes()).toBe(15);
    expect(roundUp(new Date(2026, 5, 1, 10, 15)).getMinutes()).toBe(15);
    expect(roundUp(new Date(2026, 5, 1, 10, 15, 1)).getMinutes()).toBe(30);
    const late = roundUp(new Date(2026, 5, 1, 23, 50));
    expect([late.getDate(), late.getHours(), late.getMinutes()]).toEqual([
      2, 0, 0,
    ]);
  });

  it("offers 96 times a day and builds a date from one", () => {
    expect(timeSlots()).toHaveLength(96);
    expect(timeSlots().at(-1)).toBe(23 * 60 + 45);
    const at = atMinutes(new Date(2026, 5, 1, 9, 0), 18 * 60 + 45);
    expect([at.getHours(), at.getMinutes()]).toEqual([18, 45]);
  });

  it("writes Latin digits in Arabic and follows the 12/24 hour choice", () => {
    const formats = dateFormats("ar", false);
    const text = formats.time.format(new Date(2026, 5, 1, 18, 45));
    expect(text).toMatch(/18:45/);
    expect(text).not.toMatch(/[٠-٩]/);
    expect(
      dateFormats("en", true).time.format(new Date(2026, 5, 1, 18, 45)),
    ).toMatch(/6:45/);
    expect(hour12From("HH:mm")).toBe(false);
    expect(hour12From("h:mm A")).toBe(true);
    expect(hour12From(undefined)).toBeUndefined();
  });
});
