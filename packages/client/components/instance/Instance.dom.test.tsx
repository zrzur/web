/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles */
import { describe, expect, it, vi } from "vitest";

vi.mock("@revolt/common", () => ({ CONFIGURATION: { DEV_GIFBOX_URL: "" } }));
vi.mock("@revolt/common/lib/env", () => ({
  assertAllowedServiceUrl: () => undefined,
  assertConnectionHostAllowed: () => undefined,
  ZRZUR_OFFICIAL_HOSTS: [],
}));
vi.mock("@revolt/client/billing", () => ({
  activePlusLimits: () => undefined,
}));
vi.mock(".", () => ({ DefaultHost: "app.example" }));
vi.mock("@zrzur/sdk/solid", () => ({
  Client: class {
    options = { baseURL: "http://api.example" };
    initConfig = vi.fn();
    events = { removeAllListeners: vi.fn(), disconnect: vi.fn() };
    removeAllListeners = vi.fn();
    channelUnreads = { cancelBackgroundSync: vi.fn() };
  },
}));

import Instance from "./Instance";

function client() {
  return {
    configuration: {
      ws: "",
      features: {
        autumn: { url: "http://m" },
        january: { url: "http://p" },
        limits: { global: {}, new_user: {} },
      },
    },
    events: { removeAllListeners: vi.fn(), disconnect: vi.fn() },
    removeAllListeners: vi.fn(),
    channelUnreads: { cancelBackgroundSync: vi.fn() },
  } as never;
}

describe("Instance.newClient", () => {
  it("stops the old client's background unread sync before replacing it", () => {
    const first = client() as any;
    const instance = new Instance(
      { api: "http://api.example" } as never,
      first,
      "",
      {} as never,
    );

    // the first login reuses the client it was made with
    expect(instance.newClient()).toBe(first);
    expect(first.channelUnreads.cancelBackgroundSync).not.toHaveBeenCalled();

    const second = instance.newClient();
    expect(second).not.toBe(first);
    // a retry timer on the old client would otherwise fire for a client
    // nobody uses and keep hitting /sync/unreads
    expect(first.channelUnreads.cancelBackgroundSync).toHaveBeenCalledTimes(1);
  });
});
