import { createSignal } from "solid-js";
import { render } from "solid-js/web";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const started = vi.hoisted(() => ({ host: 0, sandbox: 0 }));

let client: () => unknown;
vi.mock("@revolt/client", () => ({ useClient: () => () => client() }));

// the real PluginHostRoot needs the whole app; its import is what must not happen
vi.mock("./PluginHostRoot", () => {
  started.host++;
  return { default: () => <div data-testid="plugin-host" /> };
});

// a sandbox is the only thing that makes an iframe and runs plugin code
vi.mock("./sandbox", () => ({
  PluginSandbox: class {
    constructor() {
      started.sandbox++;
    }
  },
  SANDBOX_LIMITS: {},
}));

import { PluginHostGate } from "./PluginHostGate";
import { pluginsEnabled } from "./enabled";
import { PluginHost } from "./host";
import {
  messageActions,
  notificationPolicy,
  pluginHost,
  plugins,
} from "./registry";

/** The client as the app sees it, with what the server said */
function clientWith(configuration: unknown, ready = true) {
  return {
    ready: () => ready,
    configuration,
    api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  };
}

function hostFor(fake: ReturnType<typeof clientWith>) {
  return new PluginHost({
    client: () => fake as never,
    settings: { getValue: () => false, setValue: () => undefined },
    insertText: () => undefined,
    navigate: () => undefined,
    notify: () => undefined,
    locale: () => "en",
  });
}

const CASES: [string, unknown][] = [
  ["the flag is off", { features: { plugins: false } }],
  ["the server doesn't send the flag", { features: {} }],
  ["the configuration has no features", {}],
  ["fetching the configuration failed", undefined],
];

let host: HTMLDivElement;
let dispose: (() => void) | undefined;
const fetchSpy = vi.fn();

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <PluginHostGate />, host);
}

/** long enough for a lazy import and its first render */
const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

beforeEach(() => {
  started.host = 0;
  started.sandbox = 0;
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("no plugin runs while plugins are off", () => {
  for (const [name, configuration] of CASES) {
    it(`never loads the host when ${name}`, async () => {
      client = () => clientWith(configuration);
      mount();
      await settled();

      expect(host.querySelector("[data-testid=plugin-host]")).toBeNull();
      expect(started.host).toBe(0);
      expect(pluginHost()).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it(`stops a host started anyway when ${name}`, async () => {
      const fake = clientWith(configuration);
      const before = localStorage.length;
      const running = hostFor(fake);

      await running.boot();
      await running.refresh();
      await running.dispose();

      expect(fake.api.get).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(started.sandbox).toBe(0);
      expect(document.querySelector("iframe")).toBeNull();
      expect(Object.keys(plugins)).toEqual([]);
      // stored install data and local state are left alone
      expect(localStorage.length).toBe(before);
    });
  }

  it("has nothing for the message menu and no notification rules", () => {
    expect(messageActions("en")).toEqual([]);
    expect(notificationPolicy()).toEqual({
      suppress: false,
      hidePreview: false,
      muteSound: false,
      by: [],
    });
  });

  it("only a clear yes counts", () => {
    expect(pluginsEnabled(null)).toBe(false);
    expect(pluginsEnabled(undefined)).toBe(false);
    expect(pluginsEnabled({})).toBe(false);
    expect(
      pluginsEnabled({
        configuration: { features: { plugins: "true" as never } },
      }),
    ).toBe(false);
    expect(pluginsEnabled({ configuration: { features: { plugins: true } } })).toBe(
      true,
    );
  });
});

describe("with plugins on", () => {
  it("starts the host once the client is ready, and keeps it through a reconnect", async () => {
    const [ready, setReady] = createSignal(false);
    const fake = {
      ...clientWith({ features: { plugins: true } }),
      ready,
    };
    client = () => fake;
    mount();
    await settled();
    expect(host.querySelector("[data-testid=plugin-host]")).toBeNull();

    setReady(true);
    await settled();
    expect(host.querySelector("[data-testid=plugin-host]")).not.toBeNull();

    setReady(false);
    await settled();
    expect(host.querySelector("[data-testid=plugin-host]")).not.toBeNull();
  });
});
