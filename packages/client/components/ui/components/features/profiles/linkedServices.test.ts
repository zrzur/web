import { describe, expect, it } from "vitest";

import { profileConnections, serviceUrl } from "./linkedServices";

describe("linked services on a profile", () => {
  it("opens only each service's own pages", () => {
    expect(serviceUrl("twitch", "https://www.twitch.tv/maher")?.href).toBe(
      "https://www.twitch.tv/maher",
    );
    expect(serviceUrl("github", "https://github.com/maher-xs/repo")).toBeTruthy();
    expect(serviceUrl("twitch", "https://github.com/maher")).toBeUndefined();
    expect(serviceUrl("github", "http://github.com/maher")).toBeUndefined();
    expect(serviceUrl("github", "https://github.com.evil.example/x")).toBeUndefined();
    expect(serviceUrl("github", "https://user:pw@github.com/x")).toBeUndefined();
    expect(serviceUrl("github", "https://github.com:8443/x")).toBeUndefined();
    expect(serviceUrl("github", "javascript:alert(1)")).toBeUndefined();
    expect(serviceUrl("battlenet", "https://battle.net/x")).toBeUndefined();
    expect(serviceUrl("twitch", undefined)).toBeUndefined();
  });

  it("reads connections from a full profile, or none", () => {
    expect(profileConnections(undefined)).toEqual([]);
    expect(profileConnections({} as never)).toEqual([]);
    const list = [{ service: "battlenet", display_name: "A#123", profile_url: "" }];
    expect(profileConnections({ connections: list } as never)).toBe(list);
  });
});
