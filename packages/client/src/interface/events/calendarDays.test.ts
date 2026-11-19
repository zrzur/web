import { describe, expect, it } from "vitest";

import {
  calendarRange,
  calendarTitle,
  dayKey,
  eventMatches,
  eventsByDay,
  monthWeeks,
  moveAnchor,
  weekOf,
  weekStartsOn,
} from "./calendarDays";

const local = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour);

describe("the days of a calendar view", () => {
  it("starts the week where the language does", () => {
    expect(weekStartsOn("de")).toBe(1);
    expect(weekStartsOn("en-US")).toBe(0);
    expect(weekStartsOn("en-GB")).toBe(1);
    expect([6, 0]).toContain(weekStartsOn("ar"));
  });

  it("gives the seven days of a week", () => {
    // 19 November 2026 is a Thursday
    const week = weekOf(local(2026, 11, 19), 1).map(dayKey);
    expect(week[0]).toBe("2026-11-16");
    expect(week[6]).toBe("2026-11-22");
    const saturdayFirst = weekOf(local(2026, 11, 19), 6).map(dayKey);
    expect(saturdayFirst[0]).toBe("2026-11-14");
    expect(saturdayFirst[6]).toBe("2026-11-20");
  });

  it("covers a month with whole weeks", () => {
    const weeks = monthWeeks(local(2026, 11, 19), 1);
    expect(weeks.length).toBe(6);
    expect(dayKey(weeks[0][0])).toBe("2026-10-26");
    expect(dayKey(weeks[5][6])).toBe("2026-12-06");
    for (const week of weeks) expect(week.length).toBe(7);
    // February 2027 starts on a Monday and has four whole weeks
    expect(monthWeeks(local(2027, 2, 10), 1).length).toBe(4);
  });

  it("asks the server for the days it shows", () => {
    const month = calendarRange("month", local(2026, 11, 19), 1);
    expect(month.days.length).toBe(42);
    expect(dayKey(month.from)).toBe("2026-10-26");
    expect(dayKey(month.to)).toBe("2026-12-07");
    const week = calendarRange("week", local(2026, 11, 19), 1);
    expect(week.days.length).toBe(7);
    expect(dayKey(week.to)).toBe("2026-11-23");
  });

  it("moves by a month or a week", () => {
    expect(dayKey(moveAnchor("month", local(2026, 12, 31), 1))).toBe(
      "2027-01-01",
    );
    expect(dayKey(moveAnchor("month", local(2026, 1, 15), -1))).toBe(
      "2025-12-01",
    );
    expect(dayKey(moveAnchor("week", local(2026, 11, 19), 1))).toBe(
      "2026-11-26",
    );
  });

  it("names what it shows", () => {
    expect(calendarTitle("month", local(2026, 11, 19), 1, "en")).toBe(
      "November 2026",
    );
    expect(calendarTitle("week", local(2026, 11, 19), 1, "en")).toContain(
      "16",
    );
  });
});

describe("events in a calendar", () => {
  const at = (day: number, hour: number) => ({
    starts_at: local(2026, 11, day, hour).toISOString(),
  });

  it("puts each event on the local day it starts, soonest first", () => {
    const late = at(20, 21);
    const early = at(20, 9);
    const other = at(22, 12);
    const days = eventsByDay([late, other, early]);
    expect(days.get("2026-11-20")).toEqual([early, late]);
    expect(days.get("2026-11-22")).toEqual([other]);
    expect(days.get("2026-11-21")).toBeUndefined();
  });

  it("finds events by words and by place", () => {
    const event = {
      title: "Quiz Night",
      description: "Bring snacks",
      place: { type: "Voice" as const, channel: "c" },
    };
    expect(eventMatches(event, "", "any")).toBe(true);
    expect(eventMatches(event, "quiz", "any")).toBe(true);
    expect(eventMatches(event, "snacks QUIZ", "any")).toBe(true);
    expect(eventMatches(event, "chess", "any")).toBe(false);
    expect(eventMatches(event, "quiz", "Text")).toBe(false);
    expect(eventMatches(event, "  ", "Voice")).toBe(true);
    expect(
      eventMatches({ ...event, title: "ليلة الألعاب" }, "الألعاب", "any"),
    ).toBe(true);
  });
});
