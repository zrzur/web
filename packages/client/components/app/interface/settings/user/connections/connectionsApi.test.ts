import { describe, expect, it } from "vitest";

import {
  formatDay,
  steamImage,
  steamProfileUrl,
  steamStoreUrl,
} from "../../../../../ui/components/features/profiles/linkedGames";

import { steamReturnFields } from "./connectionsApi";

describe("steamReturnFields", () => {
  it("keeps the state and every openid field, nothing else", () => {
    const fields = steamReturnFields(
      "?state=abc&openid.mode=id_res&openid.claimed_id=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F1&next=%2Fevil",
    );
    expect(fields).toEqual({
      state: "abc",
      params: {
        "openid.mode": "id_res",
        "openid.claimed_id": "https://steamcommunity.com/openid/id/1",
      },
    });
  });

  it("an empty address gives an empty state", () => {
    expect(steamReturnFields("")).toEqual({ state: "", params: {} });
  });
});

describe("steamProfileUrl", () => {
  it("only Steam's own https profile pages", () => {
    expect(
      steamProfileUrl("https://steamcommunity.com/id/gamer/")?.hostname,
    ).toBe("steamcommunity.com");
    for (const bad of [
      "http://steamcommunity.com/id/gamer/",
      "https://steamcommunity.com.evil.example/id/x",
      "https://user:pw@steamcommunity.com/id/x",
      "javascript:alert(1)",
      "",
    ]) {
      expect(steamProfileUrl(bad)).toBeUndefined();
    }
  });
});

describe("steamImage", () => {
  const client = {
    proxyFile: (url: string) =>
      `https://api.zrzur.com/january/proxy?url=${encodeURIComponent(url)}`,
  };

  it("only ever hands out proxy addresses", () => {
    const url = steamImage(
      client,
      "https://media.steampowered.com/steamcommunity/public/images/apps/570/0bbb630d63262dd66d2fdd0f7d37e8661a410075.jpg",
    )!;
    expect(new URL(url).hostname).toBe("api.zrzur.com");
    expect(url).not.toMatch(/^https:\/\/media\.steampowered\.com/);
  });

  it("nothing for other hosts, plain http or no proxy", () => {
    for (const bad of [
      "https://evil.example/a.jpg",
      "http://media.steampowered.com/a.jpg",
      "javascript:alert(1)",
      undefined,
    ]) {
      expect(steamImage(client, bad)).toBeUndefined();
    }
    expect(
      steamImage(
        { proxyFile: () => undefined },
        "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
      ),
    ).toBeUndefined();
  });
});

describe("steamStoreUrl", () => {
  it("only Steam store pages", () => {
    expect(steamStoreUrl("https://store.steampowered.com/app/570/")).toBeDefined();
    expect(steamStoreUrl("https://evil.example/app/570/")).toBeUndefined();
  });
});

describe("formatDay", () => {
  it("shows the day in the reader's language without moving it", () => {
    expect(formatDay("2026-11-12", "en")).toBe("Nov 12, 2026");
    expect(formatDay("2026-01-01", "de")).toBe("01.01.2026");
    expect(formatDay("not a day", "en")).toBe("not a day");
  });
});
