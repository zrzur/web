import { describe, expect, it, vi } from "vitest";

import {
  MAX_SHOWN_REPOS,
  daysLeft,
  isServiceId,
  serviceConnectionsApi,
  serviceReturnFields,
  toggleRepo,
} from "./serviceConnectionsApi";

describe("service connections", () => {
  it("knows only the three services", () => {
    expect(isServiceId("twitch")).toBe(true);
    expect(isServiceId("github")).toBe(true);
    expect(isServiceId("battlenet")).toBe(true);
    expect(isServiceId("steam")).toBe(false);
    expect(isServiceId("../users")).toBe(false);
    expect(isServiceId(undefined)).toBe(false);
  });

  it("reads only the state and code from the return address", () => {
    expect(
      serviceReturnFields("?code=abc&state=xyz&scope=&extra=1"),
    ).toEqual({ state: "xyz", code: "abc", denied: false });
    expect(
      serviceReturnFields("?error=access_denied&error_description=no&state=x"),
    ).toEqual({ state: "x", code: "", denied: true });
    expect(serviceReturnFields("")).toEqual({
      state: "",
      code: "",
      denied: false,
    });
  });

  it("counts whole days left, never below zero", () => {
    const day = 86_400_000;
    expect(daysLeft(10 * day, 0)).toBe(10);
    expect(daysLeft(10 * day + 1, 0)).toBe(11);
    expect(daysLeft(0, 5 * day)).toBe(0);
  });

  it("switches repositories on and off up to the limit, in order", () => {
    expect(toggleRepo([1, 2], 3, true)).toEqual([1, 2, 3]);
    expect(toggleRepo([1, 2], 2, true)).toEqual([1, 2]);
    expect(toggleRepo([1, 2, 3], 2, false)).toEqual([1, 3]);
    const full = Array.from({ length: MAX_SHOWN_REPOS }, (_, i) => i);
    expect(toggleRepo(full, 99, true)).toEqual(full);
  });

  it("calls the server's routes for the chosen service", async () => {
    const raw = vi.fn().mockResolvedValue({});
    const client = { api: { raw } } as never;
    await serviceConnectionsApi.start(client, "twitch", "https://app");
    await serviceConnectionsApi.finish(client, "github", "s", "c");
    await serviceConnectionsApi.edit(client, "github", { shown_repos: [1] });
    await serviceConnectionsApi.refresh(client, "github");
    await serviceConnectionsApi.disconnect(client, "battlenet");
    expect(raw.mock.calls).toEqual([
      ["post", "/users/@me/connections/twitch/start", { origin: "https://app" }],
      ["post", "/users/@me/connections/github/finish", { state: "s", code: "c" }],
      ["patch", "/users/@me/connections/github", { shown_repos: [1] }],
      ["post", "/users/@me/connections/github/refresh"],
      ["delete", "/users/@me/connections/battlenet"],
    ]);
  });
});
