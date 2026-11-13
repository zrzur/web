import { describe, expect, it } from "vitest";

import { canRemoveLinkPreviews, hasLinkPreviews } from "./linkPreviews";

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
