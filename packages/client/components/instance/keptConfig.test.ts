import { describe, expect, it } from "vitest";

import { isNetworkFailure, keepConfig, keptConfig } from "./keptConfig";

function storage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("the server's configuration, kept for a start without a connection", () => {
  it("comes back for the same server, whatever the trailing slash", () => {
    const s = storage();
    keepConfig("https://api.example/", { ws: "wss://events.example" }, s);
    expect(keptConfig("https://api.example", s)).toEqual({
      ws: "wss://events.example",
    });
    expect(keptConfig("https://other.example", s)).toBeUndefined();
  });

  it("keeps nothing that is not a configuration, and survives damaged data", () => {
    const s = storage();
    keepConfig("https://api.example", undefined, s);
    keepConfig("https://api.example", "text", s);
    expect(s.map.size).toBe(0);
    s.map.set("zrzur:config:https://api.example", "{not json");
    expect(keptConfig("https://api.example", s)).toBeUndefined();
  });

  it("is not stopped by storage that refuses", () => {
    const refusing = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() =>
      keepConfig("https://api.example", { a: 1 }, refusing),
    ).not.toThrow();
    expect(keptConfig("https://api.example", refusing)).toBeUndefined();
  });
});

describe("no answer, as opposed to an answer that says no", () => {
  it("is a failed request of the browser", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isNetworkFailure(
        new Error("NetworkError when attempting to fetch resource."),
      ),
    ).toBe(true);
    expect(isNetworkFailure(new Error("Load failed"))).toBe(true);
  });

  it("is not an answer of the server", () => {
    expect(isNetworkFailure({ type: "InternalError" })).toBe(false);
    expect(isNetworkFailure(new Error("configuration 503"))).toBe(false);
    expect(isNetworkFailure(new Error("something else"))).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});
