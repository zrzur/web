import { describe, expect, it } from "vitest";

import type { CommunityItem } from "@revolt/app/interface/settings/user/profile/communityApi";

import { type LiveView, appendPage, applyDesignEvent } from "./live";

function design(id: string, popularity = 0, extra: Partial<CommunityItem> = {}) {
  return {
    _id: id,
    kind: "Decoration",
    name: id,
    creator_id: "maker",
    file: { _id: `file-${id}` },
    status: "Published",
    revision: 1,
    popularity,
    ...extra,
  } as unknown as CommunityItem;
}

const popular: LiveView = {
  kinds: ["Decoration", "Nameplate", "Effect"],
  sort: "popular",
  complete: false,
};

describe("live design events", () => {
  it("removes a design that left the gallery, and nothing else", () => {
    const a = design("a", 5);
    const b = design("b", 3);
    const next = applyDesignEvent([a, b], { type: "CommunityItemDelete", id: "a" }, popular);
    expect(next).toEqual([b]);
    expect(next[0]).toBe(b);
  });

  it("gives the same list back when an unknown design leaves", () => {
    const list = [design("a")];
    expect(
      applyDesignEvent(list, { type: "CommunityItemDelete", id: "zzz" }, popular),
    ).toBe(list);
  });

  it("puts a new design at the top of the newest first", () => {
    const a = design("a");
    const next = applyDesignEvent(
      [a],
      { type: "CommunityItemCreate", ...design("new") } as never,
      { ...popular, sort: "new" },
    );
    expect(next.map((i) => i._id)).toEqual(["new", "a"]);
    expect(next[1]).toBe(a);
  });

  it("puts a new design in its place by popularity", () => {
    const list = [design("a", 9), design("b", 2)];
    const next = applyDesignEvent(
      list,
      { type: "CommunityItemCreate", ...design("c", 4) } as never,
      popular,
    );
    expect(next.map((i) => i._id)).toEqual(["a", "c", "b"]);
  });

  it("leaves a design past the last loaded page to that page", () => {
    const list = [design("a", 9)];
    const event = { type: "CommunityItemCreate", ...design("c", 0) } as never;
    expect(applyDesignEvent(list, event, popular)).toBe(list);
    expect(
      applyDesignEvent(list, event, { ...popular, complete: true }).map((i) => i._id),
    ).toEqual(["a", "c"]);
  });

  it("adds nothing to a search, your favourites or a kind not shown", () => {
    const list = [design("a")];
    const event = { type: "CommunityItemCreate", ...design("c", 4) } as never;
    expect(applyDesignEvent(list, event, { ...popular, query: "crown" })).toBe(list);
    expect(applyDesignEvent(list, event, { ...popular, favourites: true })).toBe(list);
    const frame = {
      type: "CommunityItemCreate",
      ...design("f", 4, { kind: "Frame" } as never),
    } as never;
    expect(applyDesignEvent(list, frame, popular)).toBe(list);
  });

  it("changes a design in place and keeps your favourite", () => {
    const a = design("a", 5, { favourite: true } as never);
    const b = design("b", 3);
    const next = applyDesignEvent(
      [a, b],
      { type: "CommunityItemUpdate", ...design("a", 5, { name: "Big crown" }) } as never,
      popular,
    );
    expect(next[0].name).toBe("Big crown");
    expect(next[0].favourite).toBe(true);
    expect((next[0] as unknown as { type?: string }).type).toBeUndefined();
    // the other tile keeps its object, so it does not redraw
    expect(next[1]).toBe(b);
  });

  it("a design approved again that is still on screen is not doubled", () => {
    const list = [design("a", 5)];
    const next = applyDesignEvent(
      list,
      { type: "CommunityItemCreate", ...design("a", 5) } as never,
      popular,
    );
    expect(next).toHaveLength(1);
  });

  it("ignores an update of a design not on screen", () => {
    const list = [design("a")];
    expect(
      applyDesignEvent(
        list,
        { type: "CommunityItemUpdate", ...design("x") } as never,
        popular,
      ),
    ).toBe(list);
  });

  it("moves the count, not the place", () => {
    const a = design("a", 5);
    const b = design("b", 3);
    const next = applyDesignEvent(
      [a, b],
      { type: "CommunityItemPopularity", id: "b", popularity: 8 },
      popular,
    );
    expect(next.map((i) => [i._id, i.popularity])).toEqual([
      ["a", 5],
      ["b", 8],
    ]);
    expect(next[0]).toBe(a);
  });

  it("a page that repeats a design added live keeps it once", () => {
    const list = [design("new"), design("a")];
    expect(
      appendPage(list, [design("a"), design("b")]).map((i) => i._id),
    ).toEqual(["new", "a", "b"]);
  });
});
