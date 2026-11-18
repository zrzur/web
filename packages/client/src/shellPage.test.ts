import { describe, expect, it } from "vitest";

import {
  SHELL_CACHE_PREFIX,
  buildKey,
  isShellPage,
  openApp,
  staleShellCaches,
} from "./shellPage";

type Page = {
  ok: boolean;
  status: number;
  redirected?: boolean;
  headers: { get(name: string): string | null };
  body: string;
};

const page = (body: string, extra: Partial<Page> = {}): Page => ({
  ok: true,
  status: 200,
  headers: { get: (name) => (name === "content-type" ? "text/html" : null) },
  body,
  ...extra,
});

function setup(kept?: Page) {
  let stored = kept;
  const puts: string[] = [];
  return {
    puts,
    kept: () => stored,
    options: {
      store: {
        get: async () => stored,
        put: async (response: Page) => {
          stored = response;
          puts.push(response.body);
        },
      },
      copy: (response: Page) => ({ ...response }),
      offline: async () => page("no connection", { status: 503, ok: false }),
      wait: () => new Promise<void>(() => undefined),
    },
  };
}

describe("opening the app", () => {
  it("uses the network and keeps the page for later", async () => {
    const s = setup(page("old"));
    const answer = await openApp({
      ...s.options,
      ask: async () => page("new"),
    });
    expect(answer.body).toBe("new");
    expect(s.kept()?.body).toBe("new");
  });

  it("opens the kept page when there is no connection", async () => {
    const s = setup(page("kept"));
    const answer = await openApp({
      ...s.options,
      ask: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(answer.body).toBe("kept");
  });

  it("says there is no connection when nothing was kept yet", async () => {
    const s = setup();
    const answer = await openApp({
      ...s.options,
      ask: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(answer.status).toBe(503);
    expect(s.puts).toEqual([]);
  });

  it("does not wait for a slow network when a page is kept, and still keeps the late answer", async () => {
    const s = setup(page("kept"));
    let arrive: (response: Page) => void = () => undefined;
    const answer = await openApp({
      ...s.options,
      wait: async () => undefined,
      ask: () => new Promise<Page>((done) => (arrive = done)),
    });
    expect(answer.body).toBe("kept");
    arrive(page("late"));
    await new Promise((done) => setTimeout(done, 0));
    expect(s.kept()?.body).toBe("late");
  });

  it("waits for a slow network when nothing is kept", async () => {
    const s = setup();
    const answer = await openApp({
      ...s.options,
      wait: async () => undefined,
      ask: async () => {
        await new Promise((done) => setTimeout(done, 5));
        return page("slow but there");
      },
    });
    expect(answer.body).toBe("slow but there");
  });

  it("never keeps an error, a redirect or something that is not the page", async () => {
    for (const answer of [
      page("oops", { ok: false, status: 500 }),
      page("moved", { redirected: true }),
      page("{}", { headers: { get: () => "application/json" } }),
    ]) {
      const s = setup(page("kept"));
      const got = await openApp({ ...s.options, ask: async () => answer });
      // what the server said is shown as it is
      expect(got.body).toBe(answer.body);
      expect(s.kept()?.body).toBe("kept");
    }
    expect(isShellPage(page("fine"))).toBe(true);
  });

  it("still opens online when the device refuses storage", async () => {
    const s = setup();
    const answer = await openApp({
      ...s.options,
      store: {
        get: async () => undefined,
        put: async () => {
          throw new Error("QuotaExceededError");
        },
      },
      ask: async () => page("new"),
    });
    expect(answer.body).toBe("new");
  });
});

describe("one kept page per build", () => {
  it("names a build by its files, whatever their order", () => {
    expect(buildKey(["a.js", "b.css"])).toBe(buildKey(["b.css", "a.js"]));
    expect(buildKey(["a.js", "b.css"])).not.toBe(buildKey(["a.js", "c.css"]));
    expect(buildKey([])).toMatch(/^[0-9a-z]+$/);
  });

  it("removes the pages of other builds only", () => {
    const now = `${SHELL_CACHE_PREFIX}abc`;
    expect(
      staleShellCaches(
        [
          now,
          `${SHELL_CACHE_PREFIX}old`,
          "zrzur-assets-v1",
          "workbox-precache-v2",
        ],
        now,
      ),
    ).toEqual([`${SHELL_CACHE_PREFIX}old`]);
  });
});
