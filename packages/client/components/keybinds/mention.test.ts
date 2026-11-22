import { describe, expect, it } from "vitest";

import {
  MENTION_TOKEN,
  channelFromHref,
  insertMention,
  isMentionClick,
  mentionText,
  needsLeadingSpace,
  setMentionTarget,
} from "./mention";

const ID = "01HZX8Y2K3M4N5P6Q7R8S9T0VW";

const click = (mods: Partial<MouseEvent> = {}) => ({
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  button: 0,
  ...mods,
});

describe("mentionText", () => {
  it("writes people, roles and channels the way messages do, with a space", () => {
    expect(mentionText("user", ID)).toBe(`<@${ID}> `);
    expect(mentionText("role", ID)).toBe(`<%${ID}> `);
    expect(mentionText("channel", ID)).toBe(`<#${ID}> `);
  });

  it("refuses anything that is not an id", () => {
    expect(mentionText("user", "everyone")).toBe(undefined);
    expect(mentionText("user", `${ID}>`)).toBe(undefined);
  });

  it("is recognised as a mention token", () => {
    expect(MENTION_TOKEN.test(mentionText("user", ID)!)).toBe(true);
    expect(MENTION_TOKEN.test("hello ")).toBe(false);
  });
});

describe("needsLeadingSpace", () => {
  it("adds a space only after a word", () => {
    expect(needsLeadingSpace("")).toBe(false);
    expect(needsLeadingSpace(" ")).toBe(false);
    expect(needsLeadingSpace("\n")).toBe(false);
    expect(needsLeadingSpace("a")).toBe(true);
    expect(needsLeadingSpace("ب")).toBe(true);
  });
});

describe("isMentionClick", () => {
  it("is Shift and the main button only", () => {
    expect(isMentionClick(click({ shiftKey: true }))).toBe(true);
    expect(isMentionClick(click())).toBe(false);
    expect(isMentionClick(click({ shiftKey: true, ctrlKey: true }))).toBe(
      false,
    );
    expect(isMentionClick(click({ shiftKey: true, metaKey: true }))).toBe(
      false,
    );
    expect(isMentionClick(click({ shiftKey: true, button: 1 }))).toBe(false);
  });
});

describe("insertMention", () => {
  it("goes to the newest message box, and nowhere once it closed", () => {
    const first: string[] = [];
    const second: string[] = [];
    const offFirst = setMentionTarget((text) => (first.push(text), true));
    const offSecond = setMentionTarget((text) => (second.push(text), true));
    expect(insertMention("user", ID)).toBe(true);
    expect(second).toEqual([`<@${ID}> `]);
    expect(first).toEqual([]);
    offSecond();
    expect(insertMention("role", ID)).toBe(true);
    expect(first).toEqual([`<%${ID}> `]);
    offFirst();
    expect(insertMention("user", ID)).toBe(false);
  });

  it("says no when the box can't take it (no right to write)", () => {
    const off = setMentionTarget(() => false);
    expect(insertMention("user", ID)).toBe(false);
    off();
  });
});

describe("channelFromHref", () => {
  it("reads a channel link, not a message link", () => {
    expect(channelFromHref(`/server/${ID}/channel/${ID}`)).toBe(ID);
    expect(channelFromHref(`https://app.zrzur.com/channel/${ID}`)).toBe(ID);
    expect(channelFromHref(`/server/${ID}/channel/${ID}/${ID}`)).toBe(
      undefined,
    );
    expect(channelFromHref("/settings")).toBe(undefined);
    expect(channelFromHref(null)).toBe(undefined);
  });
});
