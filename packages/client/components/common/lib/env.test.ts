import { describe, expect, test } from "vitest";

import {
  assertAllowedServiceUrl,
  assertConnectionHostAllowed,
  isProhibitedEndpoint,
  isProhibitedHostname,
  normalizeHost,
  parseHostname,
  resolveCommunityInvite,
  resolveDefaultApiUrl,
  resolveDefaultHost,
  resolveDesignsHost,
  resolveSupportUrl,
  STOAT_HOST,
  ZRZUR_HOST,
} from "./env";

describe("parseHostname", () => {
  test("parses bare hosts, ports, and trailing dots", () => {
    expect(parseHostname("API.Stoat.Chat.")).toBe("api.stoat.chat");
    expect(parseHostname("localhost:14702")).toBe("localhost");
    expect(parseHostname("127.0.0.1:14702")).toBe("127.0.0.1");
  });

  test("parses absolute URLs including ws and path variants", () => {
    expect(parseHostname("https://api.stoat.chat/api")).toBe("api.stoat.chat");
    expect(parseHostname("wss://ws.stoat.chat/events")).toBe("ws.stoat.chat");
    expect(parseHostname("http://127.0.0.1:14704/")).toBe("127.0.0.1");
    expect(parseHostname("https://app.zrzur.com")).toBe("app.zrzur.com");
  });

  test("returns null for empty or garbage input", () => {
    expect(parseHostname("")).toBeNull();
    expect(parseHostname("   ")).toBeNull();
    expect(parseHostname("http://")).toBeNull();
  });
});

describe("isProhibitedHostname / isProhibitedEndpoint", () => {
  test("blocks upstream roots and subdomains (case / FQDN insensitive)", () => {
    expect(isProhibitedHostname("stoat.chat")).toBe(true);
    expect(isProhibitedHostname("API.STOAT.CHAT")).toBe(true);
    expect(isProhibitedHostname("canary-api.stoat.chat")).toBe(true);
    expect(isProhibitedHostname("autumn.revolt.chat")).toBe(true);
    expect(isProhibitedHostname("cdn.stoatusercontent.com")).toBe(true);
    expect(isProhibitedHostname("gifbox.me")).toBe(true);

    expect(isProhibitedEndpoint("https://API.STOAT.CHAT/v1")).toBe(true);
    expect(isProhibitedEndpoint("https://stoat.chat./api")).toBe(true);
    expect(isProhibitedEndpoint("wss://events.revolt.chat/ws")).toBe(true);
    expect(isProhibitedEndpoint("https://cdn.stoatusercontent.com/x")).toBe(
      true,
    );
    expect(isProhibitedEndpoint("https://gifbox.me/api")).toBe(true);
  });

  test("allows Zrzur, localhost, and loopback testing endpoints", () => {
    expect(isProhibitedHostname(ZRZUR_HOST)).toBe(false);
    expect(isProhibitedHostname("api.zrzur.com")).toBe(false);
    expect(isProhibitedHostname("localhost")).toBe(false);
    expect(isProhibitedHostname("127.0.0.1")).toBe(false);

    expect(isProhibitedEndpoint("https://app.zrzur.com")).toBe(false);
    expect(isProhibitedEndpoint("https://api.zrzur.com")).toBe(false);
    expect(isProhibitedEndpoint("http://127.0.0.1:14702")).toBe(false);
    expect(isProhibitedEndpoint("ws://127.0.0.1:14703")).toBe(false);
    expect(isProhibitedEndpoint("http://localhost:14704")).toBe(false);
    expect(isProhibitedEndpoint("http://127.0.0.1:14705")).toBe(false);
    expect(isProhibitedEndpoint("http://127.0.0.1:14706")).toBe(false);
  });

  test("does not treat lookalike non-subdomains as prohibited", () => {
    // Not a subdomain of stoat.chat
    expect(isProhibitedHostname("notstoat.chat.example")).toBe(false);
    expect(isProhibitedHostname("stoat.chat.attacker.example")).toBe(false);
    expect(isProhibitedEndpoint("https://stoat.chat.attacker.example")).toBe(
      false,
    );
  });

  test("fail-closed on unparseable service endpoint strings", () => {
    expect(isProhibitedEndpoint("not a url !!!")).toBe(true);
  });
});

describe("normalizeHost", () => {
  test("collapses Stoat/Revolt variants to STOAT_HOST for comparison only", () => {
    expect(normalizeHost("stoat.chat")).toBe(STOAT_HOST);
    expect(normalizeHost("API.stoat.chat")).toBe(STOAT_HOST);
    expect(normalizeHost("beta.revolt.chat")).toBe(STOAT_HOST);
  });

  test("leaves Zrzur and local hosts unchanged", () => {
    expect(normalizeHost("app.zrzur.com")).toBe("app.zrzur.com");
    expect(normalizeHost("localhost:5173")).toBe("localhost:5173");
  });
});

describe("assertAllowedServiceUrl / assertConnectionHostAllowed", () => {
  test("allows empty optional URLs", () => {
    expect(assertAllowedServiceUrl(undefined, "x")).toBeUndefined();
    expect(assertAllowedServiceUrl("", "x")).toBe("");
  });

  test("allows Zrzur and localhost URLs", () => {
    expect(assertAllowedServiceUrl("https://api.zrzur.com", "api")).toBe(
      "https://api.zrzur.com",
    );
    expect(assertAllowedServiceUrl("http://127.0.0.1:14702", "api")).toBe(
      "http://127.0.0.1:14702",
    );
  });

  test("rejects prohibited upstream URLs", () => {
    expect(() =>
      assertAllowedServiceUrl("https://api.stoat.chat", "api"),
    ).toThrow(/must not point at upstream/);
    expect(() => assertAllowedServiceUrl("wss://ws.revolt.chat", "ws")).toThrow(
      /must not point at upstream/,
    );
    expect(() => assertConnectionHostAllowed("api.stoat.chat", "host")).toThrow(
      /must not point at upstream/,
    );
  });
});

describe("resolveDefaultHost / resolveDefaultApiUrl", () => {
  test("accepts VITE_HOST with or without a scheme", () => {
    expect(
      resolveDefaultHost({ DEV: false, VITE_HOST: "https://app.zrzur.com" }),
    ).toBe("app.zrzur.com");
    expect(
      resolveDefaultHost({ DEV: false, VITE_HOST: "app.zrzur.com" }),
    ).toBe("app.zrzur.com");
  });

  test("dev defaults to localhost / local API when unset", () => {
    expect(resolveDefaultHost({ DEV: true })).toBe("localhost");
    expect(resolveDefaultApiUrl({ DEV: true })).toBe("http://127.0.0.1:14702");
  });

  test("production requires VITE_HOST and VITE_API_URL", () => {
    expect(() => resolveDefaultHost({ DEV: false })).toThrow(/VITE_HOST/);
    expect(() => resolveDefaultApiUrl({ DEV: false })).toThrow(/VITE_API_URL/);
  });

  test("production accepts Zrzur-owned configuration", () => {
    expect(
      resolveDefaultHost({ DEV: false, VITE_HOST: "app.zrzur.com" }),
    ).toBe("app.zrzur.com");
    expect(
      resolveDefaultApiUrl({
        DEV: false,
        VITE_API_URL: "https://api.zrzur.com",
      }),
    ).toBe("https://api.zrzur.com");
  });

  test("rejects prohibited upstream configuration in both modes", () => {
    expect(() =>
      resolveDefaultHost({ DEV: true, VITE_DEV_HOST: "stoat.chat" }),
    ).toThrow(/must not point at upstream/);
    expect(() =>
      resolveDefaultHost({ DEV: false, VITE_HOST: "API.STOAT.CHAT" }),
    ).toThrow(/must not point at upstream/);
    expect(() =>
      resolveDefaultApiUrl({
        DEV: true,
        VITE_DEV_API_URL: "https://api.revolt.chat",
      }),
    ).toThrow(/must not point at upstream/);
    expect(() =>
      resolveDefaultApiUrl({
        DEV: false,
        VITE_API_URL: "https://api.stoat.chat/",
      }),
    ).toThrow(/must not point at upstream/);
  });

  test("dev prefers VITE_DEV_* over production vars", () => {
    expect(
      resolveDefaultHost({
        DEV: true,
        VITE_DEV_HOST: "localhost",
        VITE_HOST: "app.zrzur.com",
      }),
    ).toBe("localhost");
    expect(
      resolveDefaultApiUrl({
        DEV: true,
        VITE_DEV_API_URL: "http://127.0.0.1:14702",
        VITE_API_URL: "https://api.zrzur.com",
      }),
    ).toBe("http://127.0.0.1:14702");
  });
});

describe("Home links (fail closed)", () => {
  test("unset support link and invite hide the tiles", () => {
    expect(resolveSupportUrl(undefined)).toBeUndefined();
    expect(resolveSupportUrl("  ")).toBeUndefined();
    expect(resolveCommunityInvite(undefined)).toBeUndefined();
    expect(resolveCommunityInvite("")).toBeUndefined();
  });

  test("support link must be http(s) and not upstream", () => {
    expect(resolveSupportUrl("https://example.org/support")).toBe(
      "https://example.org/support",
    );
    expect(() => resolveSupportUrl("https://stoat.chat/donate")).toThrow();
    expect(() => resolveSupportUrl("https://ko-fi.stoat.chat")).toThrow();
    expect(() => resolveSupportUrl("example.org/support")).toThrow();
  });

  test("community invite must be a plain code", () => {
    expect(resolveCommunityInvite("Zrzur26")).toBe("Zrzur26");
    expect(() => resolveCommunityInvite("https://x.y/invite/abc")).toThrow();
    expect(() => resolveCommunityInvite("ab")).toThrow();
  });
});

describe("resolveDesignsHost", () => {
  test("is unset unless configured", () => {
    expect(resolveDesignsHost(undefined)).toBeUndefined();
    expect(resolveDesignsHost("  ")).toBeUndefined();
  });

  test("accepts a host with or without a scheme", () => {
    expect(resolveDesignsHost("designs.zrzur.com")).toBe("designs.zrzur.com");
    expect(resolveDesignsHost("https://Designs.Zrzur.com/")).toBe(
      "designs.zrzur.com",
    );
  });

  test("rejects paths and upstream hosts", () => {
    expect(() => resolveDesignsHost("zrzur.cc/designs")).toThrow(
      /VITE_DESIGNS_HOST/,
    );
    expect(() => resolveDesignsHost("designs.stoat.chat")).toThrow(/upstream/);
  });
});
