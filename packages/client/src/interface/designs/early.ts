/**
 * The first page of community designs, asked for by the first code that runs
 * on the Designs site (src/index.tsx), at the same time as the page's own
 * code. Before, it was asked for only after that code had arrived and drawn
 * the page: on a slow phone a second later.
 *
 * Kept small and without imports: the entry file loads it.
 */

/** The kinds the wall shows, in the order it asks for them */
export const EARLY_KINDS = ["decorations", "nameplates", "effects"] as const;

/** What the wall asks for first: most worn, one page */
export const EARLY_LIMIT = 48;

const early = new Map<string, Promise<unknown>>();

/** The paths of the site that open on the wall (not a design, not creators) */
export function opensWall(path: string) {
  const first = path.split("/").filter(Boolean)[0];
  return (
    first === undefined ||
    [
      "looks",
      "decorations",
      "nameplates",
      "effects",
      "frames",
      "colours",
      "name",
      "community",
    ].includes(first)
  );
}

/**
 * Ask for the first page of each kind now. Without credentials: the answer
 * is only used for someone who is not signed in (signed in, each design also
 * says whether it is one of your favourites).
 */
export function startEarlyDesigns(api: string) {
  for (const kind of EARLY_KINDS) {
    const asked = fetch(
      `${api.replace(/\/+$/, "")}/community/${kind}?sort=popular&limit=${EARLY_LIMIT}`,
      { credentials: "omit" },
    ).then((response) => {
      if (!response.ok) throw new Error(`community ${response.status}`);
      return response.json();
    });
    // nobody may ever take it (signed in): never an unhandled rejection
    asked.catch(() => {});
    early.set(kind, asked);
  }
}

/** The early answer for a kind, once; undefined when there is none */
export function takeEarly<T>(kind: string): Promise<T> | undefined {
  const asked = early.get(kind);
  early.delete(kind);
  return asked as Promise<T> | undefined;
}

/** Tests only: forget every early answer */
export function clearEarly() {
  early.clear();
}
