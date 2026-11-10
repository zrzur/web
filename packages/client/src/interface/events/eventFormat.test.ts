import { describe, expect, it } from "vitest";

import {
  eventLink,
  eventPhase,
  eventWhen,
  isEventsShortcut,
  startsIn,
  upcomingCount,
} from "./eventFormat";

const NOW = Date.parse("2026-12-01T12:00:00Z");

describe("event times", () => {
  it("names the time zone and keeps one day for a same-day range", () => {
    const text = eventWhen(
      { starts_at: "2026-12-01T17:00:00Z", ends_at: "2026-12-01T19:00:00Z" },
      "en",
      false,
      "Europe/Vienna",
    );
    expect(text).toMatch(/18:00/);
    expect(text).toMatch(/20:00/);
    expect(text).toMatch(/GMT\+1|CET/);
    expect(text.match(/Dec/g)).toHaveLength(1);
  });

  it("follows the language, with Latin digits in Arabic", () => {
    const text = eventWhen(
      { starts_at: "2026-12-01T17:00:00Z" },
      "ar",
      false,
      "Asia/Damascus",
    );
    expect(text).toMatch(/20:00/);
    expect(text).not.toMatch(/[٠-٩]/);
    const german = eventWhen(
      { starts_at: "2026-12-01T17:00:00Z" },
      "de",
      false,
      "Europe/Berlin",
    );
    expect(german).toMatch(/Dez/);
  });

  it("says how soon in words", () => {
    expect(startsIn("2026-12-01T12:30:00Z", NOW, "en")).toBe("in 30 minutes");
    expect(startsIn("2026-12-01T15:00:00Z", NOW, "en")).toBe("in 3 hours");
    expect(startsIn("2026-12-02T12:00:00Z", NOW, "en")).toBe("tomorrow");
    expect(startsIn("2026-12-01T15:00:00Z", NOW, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("tells live, soon, later and over apart", () => {
    expect(
      eventPhase({ status: "Active", starts_at: "2026-12-01T10:00:00Z" }, NOW),
    ).toBe("live");
    expect(
      eventPhase(
        { status: "Scheduled", starts_at: "2026-12-01T12:45:00Z" },
        NOW,
      ),
    ).toBe("soon");
    expect(
      eventPhase(
        { status: "Scheduled", starts_at: "2026-12-02T12:00:00Z" },
        NOW,
      ),
    ).toBe("later");
    expect(
      eventPhase(
        { status: "Cancelled", starts_at: "2026-12-02T12:00:00Z" },
        NOW,
      ),
    ).toBe("over");
  });

  it("links into the app and counts what is ahead", () => {
    expect(eventLink("https://app.zrzur.com", "S", "E")).toBe(
      "https://app.zrzur.com/server/S/events/E",
    );
    expect(
      upcomingCount([
        { status: "Scheduled" },
        { status: "Active" },
        { status: "Completed" },
        { status: "Cancelled" },
      ]),
    ).toBe(2);
  });

  it("opens with Alt+Shift+E on any keyboard layout", () => {
    const key = {
      code: "KeyE",
      altKey: true,
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
    };
    expect(isEventsShortcut(key)).toBe(true);
    expect(isEventsShortcut({ ...key, ctrlKey: true })).toBe(false);
    expect(isEventsShortcut({ ...key, shiftKey: false })).toBe(false);
    expect(isEventsShortcut({ ...key, code: "KeyQ" })).toBe(false);
  });
});
