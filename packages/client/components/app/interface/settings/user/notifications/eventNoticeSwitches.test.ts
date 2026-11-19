import { describe, expect, it } from "vitest";

import { parseEventNotices, serializeEventNotices } from "./eventNoticeSwitches";

describe("switches for the notices of events", () => {
  it("has everything on until something is switched off", () => {
    const all = { reminders: true, changes: true, invitations: true, seats: true };
    expect(parseEventNotices(undefined)).toEqual(all);
    expect(parseEventNotices("")).toEqual(all);
    expect(parseEventNotices("not json")).toEqual(all);
    expect(parseEventNotices("[1]")).toEqual(all);
    expect(parseEventNotices('{"reminders":"no"}')).toEqual(all);
  });

  it("reads and writes what is off", () => {
    const switches = parseEventNotices('{"reminders":false,"seats":false}');
    expect(switches).toEqual({
      reminders: false,
      changes: true,
      invitations: true,
      seats: false,
    });
    expect(serializeEventNotices(switches)).toBe(
      '{"reminders":false,"seats":false}',
    );
    expect(
      serializeEventNotices(parseEventNotices(undefined)),
    ).toBe("{}");
  });
});
