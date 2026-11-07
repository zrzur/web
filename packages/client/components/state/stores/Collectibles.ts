import { AbstractSyncedStore } from ".";
import { State } from "..";

/**
 * A decoration or nameplate the user saved or wore
 */
export interface CollectibleRef {
  /**
   * Built-in id, or `c:<id>` for a community item
   */
  id: string;

  /**
   * Image of a community item, so it can be shown without a lookup
   */
  file?: string;
}

export type CollectibleKind = "decorations" | "nameplates";

interface CollectibleLists {
  favourites: CollectibleRef[];
  recent: CollectibleRef[];
}

export type TypeCollectibles = Record<CollectibleKind, CollectibleLists>;

/** How many recently worn items are kept per kind */
const RECENT_LIMIT = 8;
/** How many favourites are kept per kind */
const FAVOURITE_LIMIT = 48;

const cleanRefs = (input: unknown, limit: number): CollectibleRef[] =>
  (Array.isArray(input) ? input : [])
    .filter(
      (ref): ref is CollectibleRef =>
        typeof ref?.id === "string" &&
        ref.id.length > 0 &&
        ref.id.length < 64 &&
        (ref.file === undefined || typeof ref.file === "string"),
    )
    .map((ref) => (ref.file ? { id: ref.id, file: ref.file } : { id: ref.id }))
    .filter((ref, i, all) => all.findIndex((o) => o.id === ref.id) === i)
    .slice(0, limit);

/**
 * Favourite and recently worn decorations and nameplates, synced across the
 * user's devices so the gallery looks the same everywhere.
 */
export class Collectibles extends AbstractSyncedStore<
  "collectibles",
  TypeCollectibles
> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "collectibles");
    this.toggleFavourite = this.toggleFavourite.bind(this);
    this.isFavourite = this.isFavourite.bind(this);
    this.markUsed = this.markUsed.bind(this);
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeCollectibles {
    return {
      decorations: { favourites: [], recent: [] },
      nameplates: { favourites: [], recent: [] },
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeCollectibles>): TypeCollectibles {
    const lists = (kind: CollectibleKind): CollectibleLists => ({
      favourites: cleanRefs(input[kind]?.favourites, FAVOURITE_LIMIT),
      recent: cleanRefs(input[kind]?.recent, RECENT_LIMIT),
    });
    return {
      decorations: lists("decorations"),
      nameplates: lists("nameplates"),
    };
  }

  /**
   * Saved items of a kind, newest first
   */
  favourites(kind: CollectibleKind) {
    return this.get()[kind].favourites;
  }

  /**
   * Recently worn items of a kind, newest first
   */
  recent(kind: CollectibleKind) {
    return this.get()[kind].recent;
  }

  /**
   * Whether an item is saved
   */
  isFavourite(kind: CollectibleKind, id: string) {
    return this.get()[kind].favourites.some((ref) => ref.id === id);
  }

  /**
   * Save or unsave an item
   */
  toggleFavourite(kind: CollectibleKind, ref: CollectibleRef) {
    const list = this.get()[kind].favourites;
    this.set(
      kind,
      "favourites",
      this.isFavourite(kind, ref.id)
        ? list.filter((o) => o.id !== ref.id)
        : cleanRefs([ref, ...list], FAVOURITE_LIMIT),
    );
  }

  /**
   * Put an item at the front of the recently worn list
   */
  markUsed(kind: CollectibleKind, ref: CollectibleRef) {
    this.set(
      kind,
      "recent",
      cleanRefs([ref, ...this.get()[kind].recent], RECENT_LIMIT),
    );
  }
}
