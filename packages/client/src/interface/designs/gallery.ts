import type { UserStyle } from "@revolt/ui/components/features/profiles/userStyle";

/** The kinds of tile on the wall; each has its own shape */
export type TileKind =
  | "look"
  | "frame"
  | "plate"
  | "effect"
  | "paint"
  | "type"
  | "ink"
  | "mood"
  | "maker"
  | "open";

/** What the gallery is showing; the old addresses still lead here */
export type WallFilter =
  | "all"
  | "looks"
  | "decorations"
  | "nameplates"
  | "effects"
  | "colours"
  | "name"
  | "community";

/**
 * The order the kinds take turns on the wall. Neighbours differ, so six
 * designs and six hundred read the same way: a mix, not rows of one thing.
 */
export const RHYTHM: TileKind[] = [
  "look",
  "frame",
  "frame",
  "plate",
  "maker",
  "effect",
  "frame",
  "look",
  "type",
  "frame",
  "mood",
  "plate",
  "effect",
  "frame",
  "paint",
  "look",
  "frame",
  "ink",
  "plate",
  "frame",
  "open",
  "type",
];

/**
 * Weave lists of tiles into one wall. The rhythm repeats until every list
 * is empty; a kind that runs out is skipped. The order inside a kind stays.
 */
export function weave<T>(
  lists: Partial<Record<TileKind, T[]>>,
  rhythm: TileKind[] = RHYTHM,
): T[] {
  const left = new Map(
    Object.entries(lists).map(([kind, list]) => [kind, [...(list ?? [])]]),
  );
  const wall: T[] = [];
  let remaining = [...left.values()].reduce((sum, l) => sum + l.length, 0);
  while (remaining > 0) {
    for (const kind of rhythm) {
      const next = left.get(kind)?.shift();
      if (next === undefined) continue;
      wall.push(next);
      remaining--;
    }
    // kinds that are not in the rhythm still get shown
    if (![...left.keys()].some((kind) => rhythm.includes(kind as TileKind)))
      break;
    if (
      remaining > 0 &&
      ![...left.entries()].some(
        ([kind, list]) => list.length && rhythm.includes(kind as TileKind),
      )
    )
      break;
  }
  return wall;
}

/** One frame in five is shown huge, so the wall has a beat */
export const isGiantFrame = (index: number) => index % 5 === 0;

/** Every third nameplate runs edge to edge */
export const isPlateBand = (index: number) => index % 3 === 0;

let motion: IntersectionObserver | undefined;

/**
 * Animated decorations run only for tiles on screen. One observer for all
 * tiles; it marks them directly, so nothing renders again while you scroll.
 */
export function watchMotion(el: Element) {
  motion ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        entry.target.toggleAttribute("data-awake", entry.isIntersecting);
    },
    { rootMargin: "120px" },
  );
  motion.observe(el);
  return () => motion?.unobserve(el);
}

/**
 * How many tiles a page shows: about two screens of the wall. The next page
 * comes only when asked for with "Show more", so a long list never grows
 * under the reader while they scroll.
 */
export const PAGE_TILES = 24;

/**
 * Fetch the next page of community designs once the page after this one
 * would not be full, so the press after next finds it already here
 */
export const needsMore = (
  visible: number,
  total: number,
  more: boolean,
  loading: boolean,
  page = PAGE_TILES,
) => more && !loading && visible + page > total;

/**
 * What the foot of a paged list shows: the button, the button waiting for
 * the server, a plain end line after a list longer than a page, or nothing
 */
export type MoreState = "more" | "loading" | "end" | "none";

export function moreState(
  visible: number,
  total: number,
  more: boolean,
  loading: boolean,
  page = PAGE_TILES,
): MoreState {
  if (visible < total) return "more";
  if (loading) return "loading";
  if (more) return "more";
  return total > page ? "end" : "none";
}

/** What a tile puts on you */
export type Wear = Partial<UserStyle>;

/** Whether a tile's pieces are all on the person right now */
export function isOn(style: UserStyle, wear: Wear) {
  return Object.entries(wear).every(([key, value]) => {
    const current = style[key as keyof UserStyle];
    if (value === undefined) return true;
    return Array.isArray(value)
      ? (current as string[] | undefined)?.join() === value.join()
      : current === value;
  });
}

/** The same piece taken off again: a second tap on a tile */
export function takenOff(wear: Wear): Wear {
  return Object.fromEntries(
    Object.keys(wear).map((key) => [key, undefined]),
  ) as Wear;
}
