import { describe, expect, it } from "vitest";

import {
  canAddReminder,
  dueProblem,
  presetTimes,
  savedRemindersEnabled,
  splitReminders,
  suggestedCustomTime,
} from "./savedModel";

/** A moment on the device's own clock */
const local = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) => new Date(year, month - 1, day, hour, minute, 0, 0);

const byPreset = (now: Date) =>
  Object.fromEntries(presetTimes(now).map((item) => [item.preset, item]));

describe("the feature switch", () => {
  it("is on only for a clear yes", () => {
    expect(
      savedRemindersEnabled({
        configuration: { features: { saved_reminders: true } },
      }),
    ).toBe(true);
    for (const client of [
      undefined,
      null,
      {},
      { configuration: undefined },
      { configuration: { features: {} } },
      { configuration: { features: { saved_reminders: false } } },
      { configuration: { features: { saved_reminders: "yes" } } },
    ])
      expect(savedRemindersEnabled(client as never)).toBe(false);
  });
});

describe("ready-made reminder times", () => {
  it("in 20 minutes and in 1 hour count from now", () => {
    const now = local(2026, 11, 19, 14, 10);
    const times = byPreset(now);
    expect(times["20m"].at.getTime() - now.getTime()).toBe(20 * 60_000);
    expect(times["1h"].at.getTime() - now.getTime()).toBe(60 * 60_000);
  });

  it("tonight is 20:00 on the person's clock", () => {
    const times = byPreset(local(2026, 11, 19, 14, 10));
    expect(times.tonight.at).toEqual(local(2026, 11, 19, 20));
  });

  it("tonight is not offered once it is less than half an hour away", () => {
    expect(byPreset(local(2026, 11, 19, 19, 30)).tonight).toBeDefined();
    expect(byPreset(local(2026, 11, 19, 19, 31)).tonight).toBeUndefined();
    expect(byPreset(local(2026, 11, 19, 22, 0)).tonight).toBeUndefined();
  });

  it("tomorrow morning is 09:00 the next day", () => {
    const times = byPreset(local(2026, 11, 19, 23, 50));
    expect(times.morning.at).toEqual(local(2026, 11, 20, 9));
    expect(times.morning.sameDay).toBeUndefined();
  });

  it("crosses the end of a month and of a year", () => {
    expect(byPreset(local(2026, 11, 30, 12)).morning.at).toEqual(
      local(2026, 12, 1, 9),
    );
    expect(byPreset(local(2026, 12, 31, 12)).morning.at).toEqual(
      local(2027, 1, 1, 9),
    );
  });

  it("after midnight the morning is the one of the same day", () => {
    const times = byPreset(local(2026, 11, 20, 1, 30));
    expect(times.morning.at).toEqual(local(2026, 11, 20, 9));
    expect(times.morning.sameDay).toBe(true);
    // from 04:00 on it is the next day again
    expect(byPreset(local(2026, 11, 20, 4)).morning.at).toEqual(
      local(2026, 11, 21, 9),
    );
  });

  it("every offered time is ahead of now, in order of the list", () => {
    for (const hour of [0, 3, 4, 9, 12, 19, 20, 23]) {
      const now = local(2026, 3, 28, hour, 45);
      const list = presetTimes(now);
      expect(list.map((item) => item.preset).slice(0, 2)).toEqual([
        "20m",
        "1h",
      ]);
      for (const item of list)
        expect(item.at.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("keeps 09:00 on the wall across a daylight saving change", () => {
    // the night clocks change in Europe and the one in North America: in
    // whichever zone the tests run, the wall time must be 09:00
    for (const now of [local(2026, 3, 28, 22), local(2026, 3, 7, 22)]) {
      const morning = byPreset(now).morning.at;
      expect(morning.getHours()).toBe(9);
      expect(morning.getMinutes()).toBe(0);
      expect(morning.getDate()).toBe(now.getDate() + 1);
    }
  });
});

describe("a time the person picks", () => {
  const now = local(2026, 11, 19, 12);
  it("must be ahead of now", () => {
    expect(dueProblem(undefined, now)).toBe("past");
    expect(dueProblem(now, now)).toBe("past");
    expect(dueProblem(local(2026, 11, 19, 11, 59), now)).toBe("past");
    expect(dueProblem(local(2026, 11, 19, 12, 1), now)).toBeUndefined();
  });

  it("can't be more than a year away", () => {
    expect(dueProblem(local(2027, 11, 19, 12), now)).toBeUndefined();
    expect(dueProblem(local(2027, 11, 21, 12), now)).toBe("too-far");
  });

  it("starts at the next half hour, an hour on", () => {
    expect(suggestedCustomTime(local(2026, 11, 19, 12, 10))).toEqual(
      local(2026, 11, 19, 13, 30),
    );
    expect(suggestedCustomTime(local(2026, 11, 19, 12, 40))).toEqual(
      local(2026, 11, 19, 14),
    );
    expect(suggestedCustomTime(local(2026, 11, 19, 12, 0))).toEqual(
      local(2026, 11, 19, 13),
    );
    expect(suggestedCustomTime(local(2026, 11, 19, 23, 50))).toEqual(
      local(2026, 11, 20, 1),
    );
  });
});

describe("the reminders list", () => {
  it("shows waiting ones soonest first and delivered ones newest first", () => {
    const { waiting, due } = splitReminders([
      { id: "a", due_at: 30 },
      { id: "b", due_at: 10, delivered_at: 11 },
      { id: "c", due_at: 20 },
      { id: "d", due_at: 5, delivered_at: 40 },
      { id: "e", due_at: 25, delivered_at: null },
    ]);
    expect(waiting.map((item) => item.id)).toEqual(["c", "e", "a"]);
    expect(due.map((item) => item.id)).toEqual(["d", "b"]);
  });

  it("knows when the limit is reached", () => {
    expect(canAddReminder(9, 10)).toBe(true);
    expect(canAddReminder(10, 10)).toBe(false);
    expect(canAddReminder(3, undefined)).toBe(true);
  });
});
