import { describe, expect, it } from "vitest";

import {
  type Activity,
  activityIcon,
  clock,
  elapsedText,
  ownPicture,
  progress,
  remainingText,
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

describe("the timer", () => {
  it("reads minutes and seconds, then hours", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65_000)).toBe("1:05");
    expect(clock(3_600_000 + 2 * 60_000 + 3_000)).toBe("1:02:03");
    expect(clock(-1)).toBeUndefined();
  });

  it("counts from the start and down to the end", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const a = game({
      started_at: "2026-11-22T11:58:30Z",
      ends_at: "2026-11-22T12:01:00Z",
    });
    expect(elapsedText(a, now)).toBe("1:30");
    expect(remainingText(a, now)).toBe("1:00");
    expect(progress(a, now)).toBeCloseTo(0.6, 5);
    // a start a moment ahead of this clock still reads 0:00
    expect(elapsedText(game({ started_at: "2026-11-22T12:00:02Z" }), now)).toBe(
      "0:00",
    );
    expect(
      elapsedText(game({ started_at: "not a time" }), now),
    ).toBeUndefined();
    expect(
      remainingText(game({ ends_at: "2026-11-22T11:00:00Z" }), now),
    ).toBeUndefined();
    expect(progress(game(), now)).toBeUndefined();
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
