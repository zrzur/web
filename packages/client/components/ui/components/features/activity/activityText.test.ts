import { describe, expect, it } from "vitest";

import {
  type Activity,
  activityIcon,
  ownPicture,
  relativeTime,
  safeButtonUrl,
  shownActivities,
} from "./activityText";

const game = (over: Partial<Activity> = {}): Activity => ({
  source: "Rpc",
  type: "Playing",
  name: "Star Kebab",
  ...over,
});

describe("which activities show", () => {
  it("puts the app's own report first, then the desktop, then Steam", () => {
    const shown = shownActivities([
      game({ source: "Steam", name: "Portal 2" }),
      game({ source: "Desktop", name: "Visual Studio Code", type: "Using" }),
      game({ source: "Rpc", name: "Star Kebab" }),
    ]);
    expect(shown.map((a) => a.source)).toEqual(["Rpc", "Desktop", "Steam"]);
  });

  it("shows a game once when it reports itself and is also seen running", () => {
    const shown = shownActivities([
      game({ source: "Desktop", name: "star kebab" }),
      game({ source: "Rpc", name: "Star Kebab", details: "Level 3" }),
    ]);
    expect(shown).toHaveLength(1);
    expect(shown[0].details).toBe("Level 3");
  });

  it("copes with nothing", () => {
    expect(shownActivities(undefined)).toEqual([]);
    expect(shownActivities([game({ name: "  " })])).toEqual([]);
  });
});

describe("the time, in the reader's words", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");

  it("says how long ago it began, by the minute and the hour", () => {
    expect(relativeTime("2026-11-22T11:48:00Z", now, "en")).toBe("12 minutes ago");
    expect(relativeTime("2026-11-22T09:30:00Z", now, "en")).toBe("2 hours ago");
    expect(relativeTime("2026-11-22T11:59:30Z", now, "en")).toBe("30 seconds ago");
    expect(relativeTime("2026-11-20T12:00:00Z", now, "en")).toBe("2 days ago");
    expect(relativeTime("2026-11-22T11:48:00Z", now, "de")).toBe("vor 12 Minuten");
    expect(relativeTime("2026-11-22T11:48:00Z", now, "ar")).toMatch(/12|١٢/);
  });

  it("says when it ends, and nothing for a past end or no time", () => {
    expect(relativeTime("2026-11-22T12:03:00Z", now, "en", true)).toBe("in 3 minutes");
    expect(relativeTime("2026-11-22T11:00:00Z", now, "en", true)).toBeUndefined();
    expect(relativeTime(undefined, now, "en")).toBeUndefined();
    expect(relativeTime("not a time", now, "en")).toBeUndefined();
    // a start a moment ahead of this clock reads "now"
    expect(relativeTime("2026-11-22T12:00:02Z", now, "en")).toBe("now");
  });
});

describe("pictures and links", () => {
  const hosts = ["https://proxy.zrzur.com", "https://cdn.zrzur.com"];

  it("loads pictures only from Zrzur's own servers", () => {
    expect(ownPicture("https://proxy.zrzur.com/proxy?url=x", hosts)).toBe(
      "https://proxy.zrzur.com/proxy?url=x",
    );
    expect(ownPicture("https://cdn.zrzur.com/icons/abc", hosts)).toBeDefined();
    expect(ownPicture("https://evil.example/a.png", hosts)).toBeUndefined();
    expect(
      ownPicture("https://proxy.zrzur.com.evil.example/a.png", hosts),
    ).toBeUndefined();
    expect(ownPicture("http://proxy.zrzur.com/a.png", hosts)).toBeUndefined();
    expect(ownPicture("javascript:alert(1)", hosts)).toBeUndefined();
    expect(ownPicture(undefined, hosts)).toBeUndefined();
    expect(
      ownPicture("https://proxy.zrzur.com/a", [undefined, "not a url"]),
    ).toBeUndefined();
  });

  it("opens only https buttons", () => {
    expect(safeButtonUrl("https://example.com/join")?.hostname).toBe(
      "example.com",
    );
    expect(safeButtonUrl("http://example.com")).toBeUndefined();
    expect(safeButtonUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeButtonUrl("https://user@example.com")).toBeUndefined();
    expect(safeButtonUrl("nonsense")).toBeUndefined();
  });

  it("gives each kind its own icon", () => {
    const kinds = [
      "Playing",
      "Listening",
      "Watching",
      "Streaming",
      "Competing",
      "Using",
    ] as const;
    expect(new Set(kinds.map(activityIcon)).size).toBe(kinds.length);
  });
});
