import { ErrorBoundary, Show, Suspense, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lazy } from "../components/common/lib/lazyPart";

import {
  STALE_RELOAD_GAP_MS,
  STALE_RELOAD_KEY,
  holdStaleReload,
  watchForStaleBuild,
} from "./staleBuild";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const lost = () => new TypeError("Importing a module script failed.");

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** A page with the stale-build watch, on WebKit or not, and its server */
function page(opts: {
  webKit: boolean;
  server: () => Promise<string | undefined>;
  store?: Map<string, string>;
}) {
  const store = opts.store ?? new Map<string, string>();
  const reload = vi.fn();
  const fake = {
    addEventListener: () => undefined,
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    location: { reload },
  } as unknown as Window;
  watchForStaleBuild(fake, {
    runningCommit: "aaaa111",
    serverCommit: opts.server,
    webKit: () => opts.webKit,
  });
  return { reload, store };
}

/** A part that never downloads, behind a button (open, then close) */
function failingPart() {
  const Part = lazy(() => Promise.reject(lost()));
  const [open, setOpen] = createSignal(false);
  const root = document.createElement("div");
  document.body.append(root);
  disposers.push(
    render(
      () => (
        <Show when={open()}>
          <ErrorBoundary fallback={<span />}>
            <Suspense>
              <Part />
            </Suspense>
          </ErrorBoundary>
        </Show>
      ),
      root,
    ),
  );
  return async () => {
    setOpen(true);
    await tick();
    setOpen(false);
    await tick();
  };
}

describe("a part pressed twice, failing both times while online", () => {
  it("WebKit: reloads once when the server answers (even with the same build)", async () => {
    const { reload } = page({ webKit: true, server: async () => "aaaa111" });
    const press = failingPart();
    await press();
    expect(reload).not.toHaveBeenCalled();
    await press();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("Chrome and Firefox: never reload for it (the next press asks again)", async () => {
    const { reload } = page({ webKit: false, server: async () => "aaaa111" });
    const press = failingPart();
    for (let i = 0; i < 4; i++) await press();
    expect(reload).not.toHaveBeenCalled();
  });

  it("WebKit: no reload when the server cannot be asked", async () => {
    const { reload } = page({ webKit: true, server: async () => undefined });
    const press = failingPart();
    await press();
    await press();
    expect(reload).not.toHaveBeenCalled();
  });

  it("WebKit: not a second time within 30 s", async () => {
    const { reload, store } = page({
      webKit: true,
      server: async () => "aaaa111",
    });
    const press = failingPart();
    await press();
    await press();
    expect(reload).toHaveBeenCalledOnce();
    expect(Number(store.get(STALE_RELOAD_KEY))).toBeGreaterThan(0);
    // the page did not go away (as if the reload did not happen): two more
    await press();
    await press();
    expect(reload).toHaveBeenCalledOnce();
    // after the gap it may again
    store.set(STALE_RELOAD_KEY, String(Date.now() - STALE_RELOAD_GAP_MS - 1));
    await press();
    await press();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("WebKit: never during a call", async () => {
    const { reload } = page({ webKit: true, server: async () => "aaaa111" });
    const release = holdStaleReload();
    const press = failingPart();
    await press();
    await press();
    release();
    expect(reload).not.toHaveBeenCalled();
  });

  it("WebKit: a call that starts while /build.json is on its way still stops it", async () => {
    let answer!: (commit: string) => void;
    const { reload } = page({
      webKit: true,
      server: () => new Promise((done) => (answer = done)),
    });
    const press = failingPart();
    await press();
    await press();
    // the server has been asked; a call starts before it answers
    const release = holdStaleReload();
    answer("aaaa111");
    await tick();
    release();
    expect(reload).not.toHaveBeenCalled();
  });
});
