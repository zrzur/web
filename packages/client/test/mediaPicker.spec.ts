import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompositionMediaPicker } from "../components/ui/components/features/messaging/composition/picker/CompositionMediaPicker";

const fixture = vi.hoisted(() => ({
  key: "https://gif.test" as string | undefined,
  send: vi.fn(),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ user: { id: "fixture" } }),
}));
vi.mock("@revolt/state", () => ({
  useState: () => ({
    auth: { getSession: () => ({ token: "session-token" }) },
  }),
}));
vi.mock("@revolt/common", () => ({
  useDevice: () => ({ isMobile: false, layout: () => "desktop" }),
  loaded: <T>(query: { isSuccess: boolean; data: T }) =>
    query.isSuccess ? query.data : undefined,
  CONFIGURATION: {
    get DEV_GIFBOX_URL() {
      return fixture.key;
    },
  },
}));
vi.mock("@revolt/ui/icons/Icon", () => ({
  Icon: () => document.createElement("span"),
}));
vi.mock("solid-floating-ui", () => ({
  useFloating: () => ({ x: 8, y: 8, strategy: "fixed" }),
}));
vi.mock(
  "../components/ui/components/features/messaging/composition/picker/EmojiPicker",
  () => ({ EmojiPicker: () => "Emoji content" }),
);

const gif = (id: number) => ({
  id,
  slug: `gif-${id}`,
  title: `GIF ${id}`,
  file: {
    md: {
      gif: {
        url: `https://media.test/${id}.gif`,
        src: `/klipy/media?u=gif${id}&e=1&s=x`,
        width: 200,
        height: 150,
      },
    },
    sm: {
      webp: {
        url: `https://media.test/${id}.webp`,
        src: `/klipy/media?u=webp${id}&e=1&s=x`,
        width: 100,
        height: 75,
      },
    },
  },
});
const page = (items: unknown[], has_next = false) => ({
  result: true,
  data: { data: items, current_page: 1, per_page: 24, has_next },
});
const categories = (items: unknown[]) => ({
  result: true,
  data: { locale: "en", categories: items },
});
function response(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body } as Response;
}
function api(handler: (url: URL) => unknown) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = new URL(String(input));
    return response(handler(url));
  });
}
const calls = (part: string) =>
  vi
    .mocked(fetch)
    .mock.calls.map(([url, init]) => ({ url: new URL(String(url)), init }))
    .filter(({ url }) => url.pathname.includes(part));

let dispose: (() => void) | undefined;
function mount() {
  const host = document.createElement("div");
  const floating = document.createElement("div");
  floating.id = "floating";
  document.body.append(host, floating);
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  dispose = render(
    () =>
      createComponent(I18nProvider, {
        i18n,
        get children() {
          return createComponent(QueryClientProvider, {
            client: queryClient,
            get children() {
              return createComponent(CompositionMediaPicker, {
                onMessage: fixture.send,
                onTextReplacement: vi.fn(),
                children: (props) => {
                  const anchor = document.createElement("div");
                  props.ref(anchor);
                  const open = document.createElement("button");
                  open.textContent = "Open GIFs";
                  open.onclick = () => props.onClickGif(undefined);
                  anchor.append(open);
                  return anchor;
                },
              });
            },
          });
        },
      }),
    host,
  );
  button("Open GIFs").click();
}
function button(text: string) {
  const result = [...document.querySelectorAll("button")].find(
    (el) => el.textContent === text || el.getAttribute("aria-label") === text,
  );
  if (!result) throw new Error(`Button missing: ${text}`);
  return result;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const type = async (value: string) => {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 360));
  await settle();
};

beforeEach(() => {
  fixture.key = "https://gif.test";
  fixture.send.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  api((url) =>
    url.pathname.endsWith("categories") ? categories([]) : page([]),
  );
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("KLIPY GIF picker", () => {
  it("fails closed without a GIF service: no requests", async () => {
    fixture.key = undefined;
    mount();
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("GIFs aren't available yet");
  });

  it("talks only to our GIF service and sends no user id", async () => {
    mount();
    await settle();
    await type("cats");
    const urls = vi.mocked(fetch).mock.calls.map(([u]) => new URL(String(u)));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.origin).toBe("https://gif.test");
      expect(url.hostname).not.toMatch(/klipy/);
      expect(url.searchParams.has("customer_id")).toBe(false);
    }
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(JSON.stringify(init ?? {})).not.toMatch(/customer_id|fixture/);
    }
  });

  it("loads previews through our GIF service", async () => {
    api((url) =>
      url.pathname.endsWith("categories") ? categories([]) : page([gif(1)]),
    );
    mount();
    await settle();
    button("Trending GIFs").click();
    await settle();
    const img = document.querySelector<HTMLImageElement>(".z-gif-tile img")!;
    expect(img.src).toBe("https://gif.test/klipy/media?u=webp1&e=1&s=x");
    // the original KLIPY address is never loaded by the browser
    expect(document.body.innerHTML).not.toContain("media.test");
  });

  it("makes no request for a GIF or category without a signed link", async () => {
    api((url) =>
      url.pathname.endsWith("categories")
        ? categories([
            {
              category: "Bare",
              query: "bare",
              preview_url: "https://media.test/x.gif",
            },
          ])
        : page([
            {
              id: 9,
              slug: "nine",
              title: "Nine",
              file: {
                sm: {
                  webp: {
                    url: "https://media.test/9.webp",
                    width: 1,
                    height: 1,
                  },
                },
              },
            },
          ]),
    );
    mount();
    await settle();
    expect(document.querySelector("img")).toBeNull();
    button("Trending GIFs").click();
    await settle();
    expect(document.querySelector(".z-gif-tile img")).toBeNull();
    expect(document.querySelector(".z-gif-preview-failed")).not.toBeNull();
  });

  it("uses KLIPY's placeholder and attribution", async () => {
    mount();
    await settle();
    expect(
      document.querySelector<HTMLInputElement>('input[type="search"]')!
        .placeholder,
    ).toBe("Search KLIPY");
    expect(document.body.textContent).toContain("Powered by KLIPY");
  });

  it("shows category tiles and searches a category without sending", async () => {
    api((url) =>
      url.pathname.endsWith("categories")
        ? categories([
            {
              category: "Hallo",
              query: "hello",
              preview_url: "https://media.test/h.gif",
            },
            {
              category: "Lol",
              query: "lol",
              preview_url: "https://media.test/l.gif",
            },
          ])
        : page([]),
    );
    mount();
    await settle();
    expect(button("Trending GIFs")).toBeTruthy();
    button("Hallo").click();
    await new Promise((resolve) => setTimeout(resolve, 360));
    await settle();
    const search = calls("/klipy/gifs").at(-1)!.url;
    expect(search.searchParams.get("query")).toBe("hello");
    expect(search.origin).toBe("https://gif.test");
    expect(search.searchParams.has("customer_id")).toBe(false);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it("sends the medium GIF once, tells nobody, and closes", async () => {
    api((url) =>
      url.pathname.endsWith("categories")
        ? categories([])
        : page([gif(1), gif(2)]),
    );
    mount();
    await settle();
    button("Trending GIFs").click();
    await settle();
    button("GIF 2").click();
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith(
      "https://media.test/2.gif",
    );
    // no share/registration call to anyone
    expect(calls("share")).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("encodes search text and shows an empty state", async () => {
    mount();
    await settle();
    await type("cats & dogs");
    const searches = calls("/klipy/gifs").filter(({ url }) =>
      url.searchParams.get("query"),
    );
    expect(searches).toHaveLength(1);
    expect(searches[0].url.searchParams.get("query")).toBe("cats & dogs");
    expect(document.body.textContent).toContain("No GIFs found");
    button("Clear search").click();
    await settle();
    expect(document.body.textContent).toContain("Trending GIFs");
  });

  it("shows an error and retry recovers", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(null, false))
      .mockResolvedValue(response(categories([])));
    mount();
    await settle();
    expect(document.body.textContent).toContain("Couldn't load GIFs");
    button("Try again").click();
    await settle();
    expect(document.body.textContent).toContain("Trending GIFs");
  });

  it("closes with Escape without sending", async () => {
    mount();
    await settle();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.send).not.toHaveBeenCalled();
  });
});
