import { beforeEach, describe, expect, it } from "vitest";

import {
  type SwitchItem,
  notePlace,
  parseQuery,
  placeFromPath,
  rankItems,
  recentPlaces,
  stepSelection,
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

describe("stepSelection", () => {
  it("moves inside the list", () => {
    expect(stepSelection(3, 0, 1)).toBe(1);
    expect(stepSelection(3, 2, 1)).toBe(2);
    expect(stepSelection(3, 0, -1)).toBe(0);
    expect(stepSelection(3, -1, -1)).toBe(2);
    expect(stepSelection(0, 0, 1)).toBe(-1);
  });
});

describe("recent places", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    } as Storage;
  });

  it("keeps channels and servers, newest first, once each", () => {
    expect(placeFromPath(`/server/${id(1)}/channel/${id(2)}`)).toBe(id(2));
    expect(placeFromPath(`/channel/${id(3)}`)).toBe(id(3));
    expect(placeFromPath(`/server/${id(4)}`)).toBe(id(4));
    expect(placeFromPath("/settings")).toBe(undefined);
    notePlace(`/channel/${id(3)}`);
    notePlace(`/server/${id(4)}`);
    notePlace(`/channel/${id(3)}`);
    notePlace("/friends");
    expect(recentPlaces()).toEqual([id(3), id(4)]);
  });
});
