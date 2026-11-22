import { beforeEach, describe, expect, it } from "vitest";

import {
  type SwitchItem,
  channelListed,
  forgetRecentPlaces,
  notePlace,
  parseQuery,
  placeFromPath,
  rankItems,
  recentPlaces,
  selectedId,
  withFolds,
} from "./quickSwitch";

const id = (n: number) =>
  `01HZX8Y2K3M4N5P6Q7R8S9T0${String(n).padStart(2, "0")}`;

const item = (
  n: number,
  kind: SwitchItem["kind"],
  name: string,
  more: Partial<SwitchItem> = {},
): SwitchItem => ({
  kind,
  id: id(n),
  name,
  unread: false,
  mentions: 0,
  updatedAt: n,
  ...more,
});

const ITEMS: SwitchItem[] = [
  item(1, "channel", "general", { place: "Game Hall" }),
  item(2, "channel", "أخبار", { place: "مجتمع" }),
  item(3, "conversation", "أسامة", { place: "Direct message" }),
  item(4, "server", "Game Hall"),
  item(5, "friend", "Samira"),
  item(6, "channel", "random", { place: "Game Hall", unread: true }),
  item(7, "channel", "help", { place: "Support", mentions: 2 }),
  item(8, "channel", "المكتبة", { place: "مجتمع" }),
];

const names = (list: SwitchItem[]) => list.map((entry) => entry.name);

describe("parseQuery", () => {
  it("reads a kind from the first character", () => {
    expect(parseQuery("#gen")).toEqual({ kinds: ["channel"], text: "gen" });
    expect(parseQuery("@ sam")).toEqual({
      kinds: ["conversation", "friend"],
      text: "sam",
    });
    expect(parseQuery("*game")).toEqual({ kinds: ["server"], text: "game" });
    expect(parseQuery(" help ")).toEqual({ text: "help" });
  });
});

describe("rankItems", () => {
  it("with nothing typed: recent first, then mentions, then unread, then latest", () => {
    const list = rankItems(ITEMS, "", [id(2), id(5)]);
    expect(names(list).slice(0, 4)).toEqual([
      "أخبار",
      "Samira",
      "help",
      "random",
    ]);
  });

  it("names that start with the text come before names that contain it", () => {
    // "general" contains "ra" too; among the two that contain it, the latest first
    expect(names(rankItems(ITEMS, "ra"))).toEqual([
      "random",
      "Samira",
      "general",
    ]);
  });

  it("folds Arabic: alef forms, ta marbuta, tatweel and the article", () => {
    expect(names(rankItems(ITEMS, "اسامه"))).toEqual(["أسامة"]);
    expect(names(rankItems(ITEMS, "اخبـار"))).toEqual(["أخبار"]);
    expect(names(rankItems(ITEMS, "مكتبة"))).toEqual(["المكتبة"]);
  });

  it("filters by kind with # @ *", () => {
    expect(names(rankItems(ITEMS, "#game"))).toEqual(["random", "general"]);
    expect(names(rankItems(ITEMS, "*game"))).toEqual(["Game Hall"]);
    expect(names(rankItems(ITEMS, "@"))).toEqual(["Samira", "أسامة"]);
  });

  it("finds a channel by its server's name, after name matches", () => {
    expect(names(rankItems(ITEMS, "support"))).toEqual(["help"]);
  });

  it("finds nothing for a name nobody has", () => {
    expect(rankItems(ITEMS, "zzz")).toEqual([]);
  });
});

describe("folded once", () => {
  it("ranks the same with names folded when the list is built", () => {
    const folded = ITEMS.map((entry) => withFolds({ ...entry }));
    for (const query of ["", "ra", "اسامه", "مكتبة", "#game", "support"])
      expect(names(rankItems(folded, query))).toEqual(
        names(rankItems(ITEMS, query)),
      );
    expect(folded[1].folded).toBe("اخبار");
  });
});

describe("channelListed", () => {
  const channel = (type: string, more: Record<string, unknown> = {}) => ({
    type,
    server: {},
    havePermission: () => true,
    ...more,
  });

  it("lists a server channel only with View Channel", () => {
    expect(channelListed(channel("TextChannel"))).toBe(true);
    expect(
      channelListed(channel("TextChannel", { havePermission: () => false })),
    ).toBe(false);
    expect(channelListed(channel("TextChannel", { server: undefined }))).toBe(
      false,
    );
  });

  it("lists open direct messages, groups and saved notes", () => {
    expect(channelListed(channel("DirectMessage", { active: true }))).toBe(
      true,
    );
    expect(channelListed(channel("DirectMessage", { active: false }))).toBe(
      false,
    );
    expect(channelListed(channel("Group"))).toBe(true);
    expect(channelListed(channel("SavedMessages"))).toBe(true);
    expect(channelListed(channel("VoiceChannel"))).toBe(false);
  });
});

describe("selectedId", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("keeps the same item when the list changes around it", () => {
    expect(selectedId(list, "b")).toBe("b");
    expect(selectedId([{ id: "x" }, { id: "b" }], "b")).toBe("b");
    expect(selectedId([{ id: "x" }], "b")).toBe("x");
  });

  it("moves with the arrows and stays inside the list", () => {
    expect(selectedId(list, "a", 1)).toBe("b");
    expect(selectedId(list, "c", 1)).toBe("c");
    expect(selectedId(list, "a", -1)).toBe("a");
    expect(selectedId(list, undefined, -1)).toBe("c");
    expect(selectedId([], "a", 1)).toBe(undefined);
  });
});

describe("recent places", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    } as Storage;
  });

  it("keeps channels and servers, newest first, once each", () => {
    expect(placeFromPath(`/server/${id(1)}/channel/${id(2)}`)).toBe(id(2));
    expect(placeFromPath(`/channel/${id(3)}`)).toBe(id(3));
    expect(placeFromPath(`/server/${id(4)}`)).toBe(id(4));
    expect(placeFromPath("/settings")).toBe(undefined);
    const me = id(90);
    notePlace(`/channel/${id(3)}`, me);
    notePlace(`/server/${id(4)}`, me);
    notePlace(`/channel/${id(3)}`, me);
    notePlace("/friends", me);
    expect(recentPlaces(me)).toEqual([id(3), id(4)]);
  });

  it("keeps each account's places apart, and forgets them all on sign-out", () => {
    notePlace(`/channel/${id(3)}`, id(90));
    notePlace(`/channel/${id(5)}`, id(91));
    expect(recentPlaces(id(90))).toEqual([id(3)]);
    expect(recentPlaces(id(91))).toEqual([id(5)]);
    expect(recentPlaces(undefined)).toEqual([]);
    store.set("other-key", "kept");
    forgetRecentPlaces();
    expect(recentPlaces(id(90))).toEqual([]);
    expect(recentPlaces(id(91))).toEqual([]);
    expect(store.get("other-key")).toBe("kept");
  });
});
