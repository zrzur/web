/**
 * Live updates for a list of community designs: the server sends a
 * `designEvent` whenever a design joins, changes in or leaves the public
 * gallery, and the list changes in place instead of being fetched again.
 * Every item keeps its object unless it changed, so only its tile redraws.
 */
import type { DesignEvent } from "@zrzur/sdk";

import type { CommunityItem } from "@revolt/app/interface/settings/user/profile/communityApi";

/** What the list on screen shows */
export type LiveView = {
  /** the kinds it loaded */
  kinds: readonly CommunityItem["kind"][];
  sort: "popular" | "new";
  /** a search: the server decides what matches, so nothing new is added */
  query?: string;
  /** your favourites: a design only gets there by your own hand */
  favourites?: boolean;
  /** every page is loaded, so a design may go at the very end */
  complete: boolean;
};

/** The design an event carries, without its `type` */
function designOf(
  event: Extract<DesignEvent, { type: "CommunityItemCreate" | "CommunityItemUpdate" }>,
): CommunityItem {
  const { type: _type, ...item } = event;
  return item as unknown as CommunityItem;
}

/** Where a new design goes in a list sorted by `sort`, or -1 for nowhere */
function placeFor(
  list: CommunityItem[],
  item: CommunityItem,
  view: LiveView,
): number {
  if (view.sort === "new") return 0;
  const at = list.findIndex((other) => other.popularity < item.popularity);
  if (at !== -1) return at;
  // past the last one loaded: the next page brings it
  return view.complete ? list.length : -1;
}

/**
 * The list after `event`. The same array comes back when nothing on it
 * changed, so nothing redraws.
 */
export function applyDesignEvent(
  list: CommunityItem[],
  event: DesignEvent,
  view: LiveView,
): CommunityItem[] {
  switch (event.type) {
    case "CommunityItemDelete": {
      const next = list.filter((item) => item._id !== event.id);
      return next.length === list.length ? list : next;
    }
    case "CommunityItemPopularity": {
      const at = list.findIndex((item) => item._id === event.id);
      if (at === -1 || list[at].popularity === event.popularity) return list;
      // the count changes, the place does not: tiles don't jump under you
      const next = [...list];
      next[at] = { ...list[at], popularity: event.popularity };
      return next;
    }
    case "CommunityItemCreate":
    case "CommunityItemUpdate": {
      const item = designOf(event);
      const at = list.findIndex((other) => other._id === item._id);
      if (at !== -1) {
        const next = [...list];
        // the event never says what is in your favourites: keep it
        next[at] = { ...item, favourite: list[at].favourite };
        return next;
      }
      // an update of something not on screen is not ours to add, and
      // neither is a new design on a search or your favourites
      if (event.type === "CommunityItemUpdate") return list;
      if (view.query || view.favourites) return list;
      if (!view.kinds.includes(item.kind)) return list;
      const place = placeFor(list, item, view);
      if (place === -1) return list;
      return [...list.slice(0, place), item, ...list.slice(place)];
    }
  }
  return list;
}

/** A page appended to a list: what live events added already stays once */
export function appendPage(
  list: CommunityItem[],
  page: CommunityItem[],
): CommunityItem[] {
  const known = new Set(list.map((item) => item._id));
  return [...list, ...page.filter((item) => !known.has(item._id))];
}
