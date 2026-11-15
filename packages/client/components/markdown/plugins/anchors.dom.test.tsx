import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Our own invite and bot links show the server card and the bot card, in
// every form the app hands out (zrzur.cc/{code} and zrzur.cc/b/{id} too), and
// never fall through to the external-link warning.

const openModal = vi.fn();

vi.mock("@revolt/app", () => ({
  MessageContextMenu: () => null,
  useMessage: () => ({}),
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/instance", () => ({
  DefaultHost: "app.zrzur.com",
  useInstance: () => ({ origin: "https://app.zrzur.com", host: undefined }),
}));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ openModal }) }));
vi.mock("@revolt/state", () => ({
  useState: () => ({ linkSafety: { isTrusted: () => false } }),
}));
vi.mock("@revolt/ui", () => ({ Avatar: () => null, iconSize: () => ({}) }));
vi.mock("@revolt/ui/components/utils/Symbol", () => ({ Symbol: () => null }));
vi.mock("@revolt/ui/icons/legacy", () => ({
  chat: () => null,
  chevron_right: () => null,
  people: () => null,
}));
vi.mock("@revolt/ui/components/features/messaging/elements/Invite", () => ({
  Invite: (props: { code: string }) => (
    <div data-card="invite" data-code={props.code} />
  ),
}));
vi.mock("@revolt/ui/components/features/messaging/elements/BotInvite", () => ({
  BotInvite: (props: { id: string; permissions?: number }) => (
    <div
      data-card="bot"
      data-id={props.id}
      data-permissions={String(props.permissions ?? "")}
    />
  ),
}));

import { RenderAnchor } from "./anchors";

// the `use:floating` directive of the app
(globalThis as Record<string, unknown>).floating = () => {};

const BOT = "01M70R4TN68KPSV0TYV7GV6K6E";
let dispose: (() => void) | undefined;

/** Render a link the way the markdown renderer does: text as children */
function setup(href: string, text: string = href, disabled?: boolean) {
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <RenderAnchor href={href} disabled={disabled}>
          {[text] as never}
        </RenderAnchor>
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return document.getElementById("root")!;
}

beforeEach(() => {
  openModal.mockClear();
  i18n.loadAndActivate({ locale: "en", messages: {} });
});
afterEach(() => dispose?.());

describe("RenderAnchor with our own links", () => {
  it.each([
    ["https://zrzur.cc/Dm8w7T5p", "Dm8w7T5p"],
    ["https://zrzur.cc/arab-gamers", "arab-gamers"],
    ["https://app.zrzur.com/invite/Dm8w7T5p", "Dm8w7T5p"],
    ["https://beta.zrzur.com/invite/Dm8w7T5p", "Dm8w7T5p"],
    ["https://app.zrzur.com/i/app.zrzur.com/invite/Dm8w7T5p", "Dm8w7T5p"],
  ])("%s shows the server card", (href, code) => {
    const root = setup(href);
    const card = root.querySelector('[data-card="invite"]');
    expect(card?.getAttribute("data-code")).toBe(code);
    expect(root.querySelector("a")).toBeNull();
  });

  it.each([
    [`https://zrzur.cc/b/${BOT}`, ""],
    [`https://zrzur.cc/b/${BOT}?permissions=8`, "8"],
    [`https://app.zrzur.com/bot/${BOT}?permissions=3`, "3"],
  ])("%s shows the bot card", (href, permissions) => {
    const root = setup(href);
    const card = root.querySelector('[data-card="bot"]');
    expect(card?.getAttribute("data-id")).toBe(BOT);
    expect(card?.getAttribute("data-permissions")).toBe(permissions);
  });

  it("inside text, the link opens the invite in the app, without a warning", () => {
    const root = setup("https://zrzur.cc/Dm8w7T5p", "join us");
    expect(root.querySelector("[data-card]")).toBeNull();
    const a = root.querySelector("a")!;
    expect(new URL(a.href).pathname).toBe("/invite/Dm8w7T5p");
    expect(new URL(a.href).origin).toBe(location.origin);
    // jsdom does not navigate
    root.addEventListener("click", (event) => event.preventDefault());
    a.click();
    expect(openModal).not.toHaveBeenCalled();
  });

  it("inside text, a bot link opens the bot in the app with its permissions", () => {
    const root = setup(`https://zrzur.cc/b/${BOT}?permissions=8`, "add it");
    const a = root.querySelector("a")!;
    const url = new URL(a.href);
    expect(url.pathname).toBe(`/bot/${BOT}`);
    expect(url.search).toBe("?permissions=8");
  });

  it("a disabled link (an edit preview) shows no card", () => {
    const root = setup("https://zrzur.cc/Dm8w7T5p", undefined, true);
    expect(root.querySelector("[data-card]")).toBeNull();
    expect(root.textContent).toBe("https://zrzur.cc/Dm8w7T5p");
  });

  it.each([
    "https://zrzur.cc.evil.com/Dm8w7T5p",
    "https://zrzur.cc/Dm8w7T5p/extra",
    "https://zrzur.cc/b/not-a-bot",
  ])("%s stays an external link behind the warning", (href) => {
    const root = setup(href);
    expect(root.querySelector("[data-card]")).toBeNull();
    const a = root.querySelector("a")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(openModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: "link_warning" }),
    );
  });
});
