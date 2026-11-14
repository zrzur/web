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
};

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
