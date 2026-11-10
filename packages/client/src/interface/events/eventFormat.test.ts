import { describe, expect, it } from "vitest";

import { RESERVED_KEYS } from "../../../../plugin-sdk/src/manifest";

import {
  EVENTS_PLUGIN_KEYS,
  eventLink,
  eventPhase,
  eventWhen,
  eventsShortcutAllowed,
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

  it("opens with Ctrl+Shift+9 by key position, never Alt+Shift", () => {
    const key = {
      code: "Digit9",
      key: "9",
      altKey: false,
      shiftKey: true,
      ctrlKey: true,
      metaKey: false,
    };
    expect(isEventsShortcut(key, false)).toBe(true);
    // German layout: Shift+9 types ")" on the same key
    expect(isEventsShortcut({ ...key, key: ")" }, false)).toBe(true);
    // Command on a Mac
    expect(
      isEventsShortcut({ ...key, ctrlKey: false, metaKey: true }, true),
    ).toBe(true);
    expect(isEventsShortcut(key, true)).toBe(false);
    // AltGr is Ctrl+Alt on Windows; Alt+Shift switches layouts
    expect(isEventsShortcut({ ...key, altKey: true }, false)).toBe(false);
    expect(
      isEventsShortcut(
        { ...key, code: "KeyE", key: "E", ctrlKey: false, altKey: true },
        false,
      ),
    ).toBe(false);
    expect(isEventsShortcut({ ...key, code: "Digit8" }, false)).toBe(false);
  });

  it("is reserved for Zrzur so plugins can't take it", () => {
    expect(RESERVED_KEYS).toContain(EVENTS_PLUGIN_KEYS);
  });

  it("stays out of text fields and open dialogs", () => {
    expect(eventsShortcutAllowed(true, false)).toBe(false);
    expect(eventsShortcutAllowed(false, true)).toBe(false);
    expect(eventsShortcutAllowed(false, false)).toBe(true);
  });
});
