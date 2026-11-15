import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A message with our own invite or bot link shows the server or bot card in
// its text; the website preview the link check stored (the app's page, with
// the generic site description) is not shown, also on old messages.

vi.mock("@revolt/instance", () => ({
  useInstance: () => ({ origin: "https://app.zrzur.com" }),
}));
vi.mock("@revolt/modal", () => ({
  useModals: () => ({ openModal: vi.fn(), showError: vi.fn() }),
}));
vi.mock("@revolt/ui", () => ({
  Embed: (props: { embed: { originalUrl?: string; url?: string } }) => (
    <div data-embed={props.embed.originalUrl ?? props.embed.url} />
  ),
  IconButton: () => <button />,
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => null }));

import { MessageEmbeds } from "./MessageEmbeds";

const BOT = "01M70R4TN68KPSV0TYV7GV6K6E";
let dispose: (() => void) | undefined;

const website = (originalUrl: string) => ({
  type: "Website",
  url: "https://app.zrzur.com/",
  originalUrl,
});

function setup(embeds: object[]) {
  const message = {
    embeds,
    author: { self: false },
    channel: { havePermission: () => false },
  };
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <MessageEmbeds message={message as never} />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
  return [...document.querySelectorAll("[data-embed]")].map((el) =>
    el.getAttribute("data-embed"),
  );
}

beforeEach(() => i18n.loadAndActivate({ locale: "en", messages: {} }));
afterEach(() => dispose?.());

describe("MessageEmbeds and our own links", () => {
  it("does not show the website preview of an invite or a bot link", () => {
    expect(
      setup([
        website("https://zrzur.cc/Dm8w7T5p"),
        website(`https://zrzur.cc/b/${BOT}`),
        website("https://app.zrzur.com/invite/Dm8w7T5p"),
      ]),
    ).toEqual([]);
  });

  it("keeps every other preview, in order", () => {
    expect(
      setup([
        website("https://example.com/a"),
        website("https://zrzur.cc/Dm8w7T5p"),
        website("https://zrzur.cc.evil.com/Dm8w7T5p"),
      ]),
    ).toEqual(["https://example.com/a", "https://zrzur.cc.evil.com/Dm8w7T5p"]);
  });
});
