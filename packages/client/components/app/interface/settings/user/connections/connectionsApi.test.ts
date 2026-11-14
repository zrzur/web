import { describe, expect, it } from "vitest";

import { steamProfileUrl } from "../../../../../ui/components/features/profiles/linkedGames";

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
