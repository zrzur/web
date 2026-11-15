import { describe, expect, it } from "vitest";

import {
  canRemoveLinkPreviews,
  hasLinkPreviews,
  isOwnLinkPreview,
  shownEmbeds,
} from "./linkPreviews";

const own = { inviteOrigin: "https://zrzur.cc", appOrigins: [] };
const BOT = "01M70R4TN68KPSV0TYV7GV6K6E";

describe("previews of our own invite and bot links", () => {
  // the link check followed zrzur.cc to the app and read the app's page
  const site = (originalUrl?: string, url = "https://app.zrzur.com/") => ({
    type: "Website",
    url,
    originalUrl,
  });

  it("are not shown: the message shows the server or bot card instead", () => {
    expect(isOwnLinkPreview(site("https://zrzur.cc/Dm8w7T5p"), own)).toBe(true);
    expect(isOwnLinkPreview(site(`https://zrzur.cc/b/${BOT}`), own)).toBe(true);
    expect(
      isOwnLinkPreview(site("https://app.zrzur.com/invite/Dm8w7T5p"), own),
    ).toBe(true);
    // an old embed without the original address
    expect(
      isOwnLinkPreview(
        site(undefined, "https://app.zrzur.com/invite/Dm8w7T5p"),
        own,
      ),
    ).toBe(true);
  });

  it("other previews stay", () => {
    expect(isOwnLinkPreview(site("https://example.com/"), own)).toBe(false);
    expect(
      isOwnLinkPreview(site("https://zrzur.cc.evil.com/Dm8w7T5p"), own),
    ).toBe(false);
    // the website itself and app pages are not invites
    expect(isOwnLinkPreview(site("https://zrzur.com/"), own)).toBe(false);
    expect(isOwnLinkPreview(site(undefined), own)).toBe(false);
    // a bot's own card is part of the message
    expect(
      isOwnLinkPreview(
        { type: "Text", url: "https://zrzur.cc/Dm8w7T5p" } as never,
        own,
      ),
    ).toBe(false);
  });

  it("shownEmbeds keeps the order of the rest", () => {
    const a = site("https://example.com/a");
    const b = site("https://zrzur.cc/Dm8w7T5p");
    const c = { type: "Image" };
    expect(shownEmbeds([a, b, c], own)).toEqual([a, c]);
    expect(shownEmbeds(undefined, own)).toEqual([]);
  });
});

const preview = { type: "Website" };
const card = { type: "Text" };
const channel = (manage: boolean) => ({ havePermission: () => manage });

describe("link previews", () => {
  it("counts previews, not a bot's own cards", () => {
    expect(hasLinkPreviews({ embeds: [preview] })).toBe(true);
    expect(hasLinkPreviews({ embeds: [{ type: "Image" }] })).toBe(true);
    expect(hasLinkPreviews({ embeds: [card] })).toBe(false);
    expect(hasLinkPreviews({ embeds: [] })).toBe(false);
    expect(hasLinkPreviews({})).toBe(false);
  });

  it("the author removes their own previews", () => {
    expect(
      canRemoveLinkPreviews({
        embeds: [preview],
        author: { self: true },
        channel: channel(false),
      }),
    ).toBe(true);
  });

  it("others need Manage Messages", () => {
    const message = { embeds: [preview], author: { self: false } };
    expect(canRemoveLinkPreviews({ ...message, channel: channel(false) })).toBe(
      false,
    );
    expect(canRemoveLinkPreviews({ ...message, channel: channel(true) })).toBe(
      true,
    );
  });

  it("never on official messages or without previews", () => {
    expect(
      canRemoveLinkPreviews({
        embeds: [preview],
        author: { official: true },
        channel: channel(true),
      }),
    ).toBe(false);
    expect(
      canRemoveLinkPreviews({
        embeds: [card],
        author: { self: true },
        channel: channel(true),
      }),
    ).toBe(false);
  });
});
