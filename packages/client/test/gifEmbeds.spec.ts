import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Embed } from "../components/ui/components/features/messaging/elements/Embed";

vi.mock("@zrzur/sdk/solid", () => ({}));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal: vi.fn() }) }));
vi.mock("@revolt/app", () => ({ MessageContextMenu: () => null }));
vi.mock("@revolt/ui/components/utils", () => ({
  SizedContent: (props: { children: unknown }) => props.children,
}));
vi.mock(
  "../components/ui/components/features/messaging/elements/TextEmbed",
  () => ({ TextEmbed: () => null }),
);
vi.mock(
  "../components/ui/components/features/messaging/elements/MediaPlayer",
  () => ({ MediaPlayer: () => null }),
);

const PROXY = "https://proxy.zrzur.test/proxy?url=";
const file = (url: string) => ({
  url,
  proxiedURL: PROXY + encodeURIComponent(url),
  width: 200,
  height: 100,
});

let dispose: (() => void) | undefined;
function mount(embed: unknown) {
  const host = document.createElement("div");
  document.body.append(host);
  const i18n = setupI18n({ locale: "en", messages: { en: {} } });
  dispose = render(
    () =>
      createComponent(I18nProvider, {
        i18n,
        get children() {
          return createComponent(Embed, { embed: embed as never });
        },
      }),
    host,
  );
  return host;
}
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});
// the directive is injected by the app; a no-op is enough here
(globalThis as Record<string, unknown>).floating = () => {};

const gifHosts = [
  "https://static.klipy.com/ii/a/b.gif",
  "https://media.tenor.com/abc/cat.gif",
  "https://media.giphy.com/media/xyz/giphy.gif",
  "https://media1.giphy.com/media/xyz/giphy.gif",
];

describe("GIFs in sent messages load only from our hosts", () => {
  for (const url of gifHosts) {
    it(`Image embed ${new URL(url).hostname}`, () => {
      const host = mount({ type: "Image", ...file(url) });
      const img = host.querySelector("img")!;
      expect(img.getAttribute("src")).toBe(PROXY + encodeURIComponent(url));
      expect(host.innerHTML).not.toMatch(
        /\/\/(static\.klipy|media\d*\.(tenor|giphy))/,
      );
    });
    it(`Video embed ${new URL(url).hostname}`, () => {
      const host = mount({
        type: "Video",
        ...file(url.replace(/\.gif$/, ".mp4")),
      });
      const video = host.querySelector("video")!;
      const src = video.getAttribute("src")!;
      expect(src.startsWith(PROXY)).toBe(true);
    });
  }
});
