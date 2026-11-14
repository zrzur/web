import { type Client, type User, UserProfile } from "@zrzur/sdk/solid";

/**
 * Linked-account types and calls. The routes are not in the SDK's API
 * document yet (contract request: stream steam-connection), so they go
 * through `raw()` and these types mirror the server's `v0` types.
 */

/** One game from a linked Steam account */
export type LinkedGame = {
  appid: number;
  name: string;
  hours: number;
  achievements_unlocked?: number;
  achievements_total?: number;
  /** On Steam's image server: load only through `proxyFile` */
  icon_url?: string;
  /** On Steam's image server: load only through `proxyFile`. Absent when
   * pictures are off for this game or this link */
  header_url?: string;
  store_url: string;
};

/** One unlocked achievement */
export type LinkedAchievement = {
  appid: number;
  game: string;
  name: string;
  description: string;
  /** On Steam's image server: load only through `proxyFile` */
  icon_url?: string;
  /** `YYYY-MM-DD`, a day without a time */
  unlocked_on: string;
};

/** Games on a profile, as another person sees them */
export type ProfileGames = {
  service: "steam" | string;
  /** Empty while private */
  display_name: string;
  /** Empty while private */
  profile_url: string;
  private: boolean;
  game_count?: number;
  total_hours?: number;
  games: LinkedGame[];
  /** Newest first */
  achievements: LinkedAchievement[];
};

/** Hosts of Steam's pictures the server hands out; anything else is ignored */
const STEAM_IMAGE_HOSTS = new Set([
  "media.steampowered.com",
  "cdn.cloudflare.steamstatic.com",
]);

/**
 * A Steam picture through Zrzur's media proxy, so viewers never contact
 * Steam. Nothing when the address is not one of Steam's or there is no
 * proxy: the caller then draws a letter tile.
 */
export function steamImage(
  client: Pick<Client, "proxyFile">,
  url?: string,
): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !STEAM_IMAGE_HOSTS.has(parsed.hostname))
      return undefined;
  } catch {
    return undefined;
  }
  return client.proxyFile(url);
}

/** Only the Steam store's own pages open from a game */
export function steamStoreUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "store.steampowered.com" &&
      !parsed.username &&
      !parsed.password
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/** A `YYYY-MM-DD` day in the reader's language, read as a day (no time zone shift) */
export function formatDay(day: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

/** A profile together with its games, which the SDK class leaves out */
export type FullProfile = UserProfile & { games?: ProfileGames };

/** The profile with its linked games, in one request */
export async function fetchFullProfile(
  client: Client,
  user: User,
): Promise<FullProfile> {
  const data = await client.api.raw<
    ConstructorParameters<typeof UserProfile>[1] & { games?: ProfileGames }
  >("get", `/users/${user.id}/profile`);
  return Object.assign(new UserProfile(client, data), { games: data.games });
}

/** The games of a profile, if it has any to show */
export function profileGames(profile?: UserProfile): ProfileGames | undefined {
  return (profile as FullProfile | undefined)?.games;
}

/** Only Steam's own profile pages open from a profile */
export function steamProfileUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "steamcommunity.com" &&
      !parsed.username &&
      !parsed.password
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}
