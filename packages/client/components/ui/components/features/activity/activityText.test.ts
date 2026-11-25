import { describe, expect, it } from "vitest";

import {
  type Activity,
  encodeQuery,
  localIcon,
  ownPicture,
  pageLink,
  proxied,
  relativeTime,
  safeButtonUrl,
  shownActivities,
  tileLetter,
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
    expect(relativeTime("2026-11-22T11:48:00Z", now, "en")).toBe(
      "12 minutes ago",
    );
    expect(relativeTime("2026-11-22T09:30:00Z", now, "en")).toBe("2 hours ago");
    expect(relativeTime("2026-11-22T11:59:30Z", now, "en")).toBe(
      "30 seconds ago",
    );
    expect(relativeTime("2026-11-20T12:00:00Z", now, "en")).toBe("2 days ago");
    expect(relativeTime("2026-11-22T11:48:00Z", now, "de")).toBe(
      "vor 12 Minuten",
    );
    expect(relativeTime("2026-11-22T11:48:00Z", now, "ar")).toMatch(/12|١٢/);
  });

  it("says when it ends, and nothing for a past end or no time", () => {
    expect(relativeTime("2026-11-22T12:03:00Z", now, "en", true)).toBe(
      "in 3 minutes",
    );
    expect(
      relativeTime("2026-11-22T11:00:00Z", now, "en", true),
    ).toBeUndefined();
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
});

describe("pictures and links (activity v2)", () => {
  it("builds the proxy address the server builds, so both hit one cached copy", () => {
    expect(
      proxied(
        "https://shared.steamstatic.com/store_item_assets/steam/apps/730/library_600x900.jpg",
        "http://127.0.0.1:14705",
      ),
    ).toBe(
      "http://127.0.0.1:14705/proxy?url=https%3A%2F%2Fshared.steamstatic.com%2Fstore_item_assets%2Fsteam%2Fapps%2F730%2Flibrary_600x900.jpg",
    );
    // the server encodes these too; encodeURIComponent would not
    expect(encodeQuery("a!b'c(d)e*f~g")).toBe("a%21b%27c%28d%29e%2Af~g");
    expect(encodeQuery("لعبة")).toBe("%D9%84%D8%B9%D8%A8%D8%A9");
  });

  it("proxies only https pictures, and only with a proxy", () => {
    expect(proxied("http://example.com/a.png", "https://proxy.zrzur.com")).toBe(
      undefined,
    );
    expect(proxied("https://example.com/a.png", undefined)).toBe(undefined);
    expect(proxied(undefined, "https://proxy.zrzur.com")).toBe(undefined);
  });

  it("takes a local icon only as a picture data address", () => {
    expect(localIcon("data:image/png;base64,iVBORw0KGgo=")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(localIcon("data:text/html;base64,PHNjcmlwdD4=")).toBe(undefined);
    expect(localIcon("data:image/svg+xml;base64,PHN2Zz4=")).toBe(undefined);
    expect(localIcon("https://example.com/a.png")).toBe(undefined);
    expect(localIcon(undefined)).toBe(undefined);
  });

  it("puts the first letter or digit on a tile, in any script", () => {
    expect(tileLetter("counter-strike 2")).toBe("C");
    expect(tileLetter("  osu!")).toBe("O");
    expect(tileLetter("«زرزور»")).toBe("ز");
    expect(tileLetter("2048")).toBe("2");
    expect(tileLetter("!!!")).toBe("?");
  });

  it("finds the official page link of a program the desktop saw", () => {
    const seen = game({
      source: "Desktop",
      buttons: [
        {
          label: "store.steampowered.com",
          url: "https://store.steampowered.com/app/730/",
        },
      ],
    });
    expect(pageLink(seen)?.host).toBe("store.steampowered.com");
    expect(pageLink(game({ source: "Desktop" }))).toBe(undefined);
    // an app's own buttons are buttons, not the page link
    expect(pageLink({ ...seen, source: "Rpc" })).toBe(undefined);
    expect(
      pageLink(
        game({
          source: "Desktop",
          buttons: [{ label: "x", url: "http://x.example/" }],
        }),
      ),
    ).toBe(undefined);
  });
});
