import type {
  CommunityCreator,
  CommunityItem,
} from "@revolt/app/interface/settings/user/profile/communityApi";

/** what a page of designs carries, with creators keyed by id */
export type Loaded = {
  items: CommunityItem[];
  creators: Record<string, CommunityCreator>;
};

export type RankedCreator = {
  creator: CommunityCreator;
  designs: number;
  uses: number;
  /** the most worn design */
  top: CommunityItem;
  /** the most worn nameplate, used as the creator's cover */
  cover?: CommunityItem;
  /** up to six of their designs, most worn first */
  shelf: CommunityItem[];
};

export function mergePages(
  pages: { items: CommunityItem[]; creators: CommunityCreator[] }[],
): Loaded {
  const creators: Record<string, CommunityCreator> = {};
  for (const page of pages)
    for (const creator of page.creators) creators[creator._id] = creator;
  return { items: pages.flatMap((page) => page.items), creators };
}

/** Creators ordered by how many people wear their designs */
export function rankCreators(data: Loaded): RankedCreator[] {
  const mine = new Map<string, CommunityItem[]>();
  for (const item of data.items) {
    if (!data.creators[item.creator_id]) continue;
    mine.set(item.creator_id, [...(mine.get(item.creator_id) ?? []), item]);
  }
  return [...mine.entries()]
    .map(([id, list]) => {
      const worn = [...list].sort((a, b) => b.popularity - a.popularity);
      return {
        creator: data.creators[id],
        designs: worn.length,
        uses: worn.reduce((sum, item) => sum + item.popularity, 0),
        top: worn[0],
        cover: worn.find((item) => item.kind === "Nameplate"),
        shelf: worn.slice(0, 6),
      };
    })
    .sort((a, b) => b.uses - a.uses || b.designs - a.designs);
}

/**
 * Which tiles of a wall are large: the first one, then one every `every`
 * tiles, so a long wall keeps a rhythm instead of a flat grid
 */
export const isFeature = (index: number, every = 7) => index % every === 0;
