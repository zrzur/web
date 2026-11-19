import { describe, expect, it } from "vitest";

import {
  MAX_ROLES,
  bodyOf,
  channelLink,
  deadChannelNames,
  draftOf,
  insertAt,
  isPowerful,
  previewOf,
  problemOf,
  toggleRole,
} from "./onJoin";

describe("draft and body", () => {
  it("starts empty when the server stored nothing", () => {
    expect(draftOf(undefined)).toEqual({
      roles: [],
      welcomeOn: false,
      channel: "",
      content: "",
    });
  });

  it("reads what is stored", () => {
    expect(
      draftOf({ roles: ["a"], welcome: { channel: "c", content: "hi" } }),
    ).toEqual({ roles: ["a"], welcomeOn: true, channel: "c", content: "hi" });
  });

  it("leaves the welcome out when it is off, whatever was typed", () => {
    expect(
      bodyOf({ roles: ["a"], welcomeOn: false, channel: "c", content: "hi" }, false),
    ).toEqual({ roles: ["a"] });
  });

  it("sends the trimmed text and the second yes only when given", () => {
    const draft = { roles: [], welcomeOn: true, channel: "c", content: "  hi  " };
    expect(bodyOf(draft, false)).toEqual({
      roles: [],
      welcome: { channel: "c", content: "hi" },
    });
    expect(bodyOf(draft, true).confirm_powerful_roles).toBe(true);
  });
});

describe("isPowerful", () => {
  const bit = (n: number) => Number(2n ** BigInt(n));

  it("flags roles that manage the server or act on members", () => {
    for (const n of [1, 3, 6, 7, 8, 23, 37, 42]) expect(isPowerful(bit(n))).toBe(true);
  });

  it("lets everyday permissions through", () => {
    // view, read history, send, invite, embeds, upload, react, connect, speak
    for (const n of [20, 21, 22, 25, 26, 27, 29, 30, 31]) expect(isPowerful(bit(n))).toBe(false);
    expect(isPowerful(0)).toBe(false);
    expect(isPowerful(undefined)).toBe(false);
  });

  it("reads a mix by its strongest part", () => {
    expect(isPowerful(bit(22) + bit(7))).toBe(true);
  });

  it("does not throw on a value that is not a whole number", () => {
    expect(isPowerful(1.5)).toBe(false);
  });
});

describe("toggleRole", () => {
  it("adds, removes and keeps the order", () => {
    expect(toggleRole(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleRole(["a", "b"], "a")).toEqual(["b"]);
  });

  it("stops at the limit", () => {
    const full = Array.from({ length: MAX_ROLES }, (_, i) => `r${i}`);
    expect(toggleRole(full, "more")).toEqual(full);
    expect(toggleRole(full, "r0")).toHaveLength(MAX_ROLES - 1);
  });
});

describe("insertAt", () => {
  it("puts a token at the caret with spaces where words would touch", () => {
    expect(insertAt("Welcome!", "{member}", 7)).toEqual({
      value: "Welcome {member}!",
      caret: 16,
    });
    expect(insertAt("Hi there", "{member}", 2).value).toBe("Hi {member} there");
    expect(insertAt("", "{server}", 0)).toEqual({ value: "{server}", caret: 8 });
  });

  it("replaces a selection", () => {
    expect(insertAt("Hi NAME now", "{member}", 3, 7).value).toBe("Hi {member} now");
  });

  it("keeps a caret outside the text inside it", () => {
    expect(insertAt("Hi", "{member}", 99).value).toBe("Hi {member}");
    expect(insertAt("Hi", "{member}", -4).value).toBe("{member} Hi");
  });

  it("does not put a space before Arabic punctuation", () => {
    expect(insertAt("أهلًا،", "{member}", 5).value).toBe("أهلًا {member}،");
  });
});

describe("preview and channel links", () => {
  it("writes a channel as a real link", () => {
    expect(channelLink("01CHANNEL")).toBe("<#01CHANNEL>");
  });

  it("fills in the member and the server, every time they appear", () => {
    expect(
      previewOf("Hi {member}, welcome to {server}. {member}!", "01ME", "Game Nights"),
    ).toBe("Hi <@01ME>, welcome to Game Nights. <@01ME>!");
  });

  it("finds channels typed as plain #name, in any case", () => {
    expect(
      deadChannelNames("Read #Rules then <#01ID> and #nothing, C#sharp", [
        "rules",
        "sharp",
        "general",
      ]),
    ).toEqual(["Rules"]);
    expect(deadChannelNames("اقرأ #القواعد أولًا", ["القواعد"])).toEqual(["القواعد"]);
    expect(deadChannelNames("Start in <#01ID>", ["01ID"])).toEqual([]);
  });
});

describe("problemOf", () => {
  const base = { roles: [], welcomeOn: true, channel: "c", content: "hi" };

  it("has nothing to say when the welcome is off or complete", () => {
    expect(problemOf({ ...base, welcomeOn: false, channel: "", content: "" })).toBeUndefined();
    expect(problemOf(base)).toBeUndefined();
  });

  it("asks for a channel, then for text, and stops at the limit", () => {
    expect(problemOf({ ...base, channel: "" })).toBe("channel");
    expect(problemOf({ ...base, content: "   " })).toBe("empty");
    expect(problemOf({ ...base, content: "x".repeat(1001) })).toBe("long");
    expect(problemOf({ ...base, content: "x".repeat(1000) })).toBeUndefined();
  });
});
