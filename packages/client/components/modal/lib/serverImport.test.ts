import { describe, expect, it } from "vitest";
import {
  type ImportReport,
  type ServerLayout,
  asksForText,
  hasWarnings,
  importAvailability,
  importFailure,
  openingChannelId,
  openingKey,
  previewRows,
  sourceOf,
} from "./serverImport";

const VIEW = 2 ** 20;
const SEND = 2 ** 22;
const FORUM_POSTS = 2 ** 45;

const layout: ServerLayout = {
  channels: [{ key: "c10", type: "Text", name: "lobby" }],
  categories: [
    {
      title: "الاستقبال",
      default_permissions: { allow: 0, deny: SEND + FORUM_POSTS },
      channels: [
        { key: "c2", type: "Text", name: "القوانين", synced: true },
        { key: "c3", type: "Text", name: "الترحيب" },
        { key: "c4", type: "Text", name: "news", announcement: true },
      ],
    },
    {
      title: "Voice",
      channels: [{ key: "c6", type: "Voice", name: "Lounge", max_users: 5 }],
    },
    {
      title: "Staff",
      default_permissions: { allow: 0, deny: VIEW },
      channels: [
        {
          key: "c9",
          type: "Text",
          name: "staff-room",
          synced: true,
          nsfw: true,
        },
        {
          key: "c11",
          type: "Text",
          name: "own-rights",
          default_permissions: { allow: 0, deny: VIEW + SEND },
        },
      ],
    },
  ],
  roles: [],
};

const report = (over: Partial<ImportReport> = {}): ImportReport => ({
  categories: 0,
  channels: 0,
  roles: 0,
  held_back: [],
  shortened: [],
  skipped_channels: [],
  over_limit_channels: 0,
  over_limit_roles: 0,
  unmatched_permissions: [],
  member_overrides: 0,
  private_channels: 0,
  mature_channels: 0,
  ...over,
});

describe("what a person pasted", () => {
  it("a link or a code is a link", () => {
    expect(sourceOf("  https://discord.new/hgM48av5Q69A ")).toEqual({
      link: "https://discord.new/hgM48av5Q69A",
    });
    expect(sourceOf("hgM48av5Q69A")).toEqual({ link: "hgM48av5Q69A" });
  });
  it("a document is text, whole or cut off", () => {
    expect(sourceOf(' {"code": "x"}')).toEqual({ text: '{"code": "x"}' });
    expect(sourceOf('"roles": [\n]')).toEqual({ text: '"roles": [\n]' });
  });
});

describe("the preview rows", () => {
  const rows = previewRows(layout);
  const named = (name: string) => {
    const row = rows.find((r) => r.kind === "channel" && r.name === name);
    if (row?.kind !== "channel") throw new Error(name);
    return row;
  };
  it("keeps the order: loose channels, then each category", () => {
    expect(
      rows.map((r) => (r.kind === "category" ? `[${r.title}]` : r.name)),
    ).toEqual([
      "lobby",
      "[الاستقبال]",
      "القوانين",
      "الترحيب",
      "news",
      "[Voice]",
      "Lounge",
      "[Staff]",
      "staff-room",
      "own-rights",
    ]);
  });
  it("a channel that follows its category shows the category's rights", () => {
    expect(named("القوانين")).toMatchObject({ readOnly: true, private: false });
    expect(named("staff-room")).toMatchObject({
      private: true,
      readOnly: false,
      mature: true,
    });
  });
  it("a channel with its own rights does not take the category's", () => {
    expect(named("الترحيب")).toMatchObject({ readOnly: false, private: false });
    // hidden says it all: no second label
    expect(named("own-rights")).toMatchObject({
      private: true,
      readOnly: false,
    });
  });
  it("reads bits above 32", () => {
    const high = previewRows({
      channels: [
        {
          key: "a",
          type: "Text",
          name: "a",
          default_permissions: { allow: 0, deny: FORUM_POSTS },
        },
      ],
      categories: [],
      roles: [],
    })[0];
    expect(high).toMatchObject({ private: false, readOnly: false });
  });
});

describe("where a built server opens", () => {
  it("on the first channel members can write in", () => {
    expect(openingKey(layout)).toBe("c10");
    const without = { ...layout, channels: [] };
    expect(openingKey(without)).toBe("c3");
  });
  it("falls back to one members can at least see", () => {
    const quiet: ServerLayout = {
      channels: [],
      categories: [layout.categories[2], layout.categories[0]],
      roles: [],
    };
    quiet.categories[1] = {
      ...quiet.categories[1],
      channels: [quiet.categories[1].channels[0]],
    };
    expect(openingKey(quiet)).toBe("c2");
  });
  it("finds the id by position in the server's answer", () => {
    const ids = ["A", "B", "C", "D", "E", "F", "G"].map((_id) => ({ _id }));
    expect(openingChannelId(layout, ids)).toBe("A");
    expect(openingChannelId({ ...layout, channels: [] }, ids)).toBe("B");
    expect(openingChannelId(layout, [])).toBeUndefined();
  });
});

describe("failures", () => {
  it("names each kind the server sends", () => {
    for (const reason of [
      "invite_link",
      "not_a_link",
      "not_a_template",
      "empty",
      "too_large",
      "nothing_given",
    ])
      expect(importFailure({ type: "ImportInvalid", reason })).toBe(reason);
    expect(importFailure({ type: "ImportInvalid", reason: "new" })).toBe(
      "not_a_template",
    );
    expect(importFailure({ type: "ImportTemplateNotFound" })).toBe("not_found");
    expect(importFailure({ type: "ImportSourceUnavailable" })).toBe(
      "unavailable",
    );
    expect(importFailure({ type: "ImportTargetNotEmpty" })).toBe("not_empty");
    expect(importFailure({ type: "RateLimited", retry_after: 5 })).toBe(
      "limited",
    );
  });
  it("finds the error inside a wrapped one, and survives anything else", () => {
    expect(importFailure({ cause: { type: "ImportTemplateNotFound" } })).toBe(
      "not_found",
    );
    for (const odd of [undefined, null, "text", 5, new Error("x"), {}])
      expect(importFailure(odd)).toBe("other");
  });
  it("only an unreachable source asks for the text", () => {
    expect(asksForText("unavailable")).toBe(true);
    expect(asksForText("not_found")).toBe(false);
    expect(asksForText("invite_link")).toBe(false);
  });
});

describe("the report", () => {
  it("has warnings only when something of the owner's was left out", () => {
    expect(hasWarnings(report())).toBe(false);
    expect(
      hasWarnings(report({ unmatched_permissions: ["USE_SOUNDBOARD"] })),
    ).toBe(false);
    expect(hasWarnings(report({ held_back: ["Admin"] }))).toBe(true);
    expect(hasWarnings(report({ shortened: ["x"] }))).toBe(true);
    expect(hasWarnings(report({ skipped_channels: ["stage"] }))).toBe(true);
    expect(hasWarnings(report({ over_limit_channels: 1 }))).toBe(true);
    expect(hasWarnings(report({ over_limit_roles: 1 }))).toBe(true);
  });
});

describe("availability", () => {
  const client = (features: unknown) =>
    ({ configuration: { features } }) as never;
  it("is closed unless the server says it is open", () => {
    expect(importAvailability(undefined)).toEqual({
      open: false,
      byLink: false,
    });
    expect(importAvailability(client({}))).toEqual({
      open: false,
      byLink: false,
    });
    expect(importAvailability(client({ server_import: "yes" }))).toEqual({
      open: false,
      byLink: false,
    });
    expect(importAvailability(client({ server_import: true }))).toEqual({
      open: true,
      byLink: false,
    });
    expect(
      importAvailability(
        client({ server_import: true, server_import_link: true }),
      ),
    ).toEqual({ open: true, byLink: true });
  });
});
