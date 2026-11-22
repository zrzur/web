import type { Client, UserProfile } from "@zrzur/sdk/solid";

/**
 * Linked Twitch, GitHub and Battle.net accounts on a profile. The server
 * sends them as `connections` next to `games` (see `fetchFullProfile`); the
 * types mirror the server's `v0` types.
 */

/** One public GitHub repository */
export type LinkedRepo = {
  id: number;
  name: string;
  description?: string;
  language?: string;
  stars: number;
  url: string;
};

/** A linked account as another person sees it */
export type ProfileConnection = {
  service: "twitch" | "github" | "battlenet";
  display_name: string;
  /** Empty for Battle.net */
  profile_url: string;
  live?: boolean;
  live_title?: string;
  repos?: LinkedRepo[];
  /** Twitch, GitHub: picture on the service's own image host */
  avatar_url?: string;
  /** GitHub: the person's own name there */
  real_name?: string;
  /** Twitch description, GitHub bio */
  bio?: string;
  /** GitHub */
  followers?: number;
  public_repos?: number;
  /** Twitch: "partner" or "affiliate" */
  kind?: string;
  /** Twitch: the category of the live stream, or of the last one */
  game?: string;
};

/** The linked accounts of a profile, if it has any to show */
export function profileConnections(profile?: UserProfile): ProfileConnection[] {
  return (
    (profile as (UserProfile & { connections?: ProfileConnection[] }) | undefined)
      ?.connections ?? []
  );
}

/** The only hosts a link from each service may open */
const HOSTS: Record<string, string> = {
  twitch: "www.twitch.tv",
  github: "github.com",
};

/** A link from a linked account, only when it goes to that service itself */
export function serviceUrl(service: string, url?: string): URL | undefined {
  const host = HOSTS[service];
  if (!host || !url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === host &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/** Image hosts each service's pictures may come from */
const IMAGE_HOSTS: Record<string, string> = {
  twitch: "static-cdn.jtvnw.net",
  github: "avatars.githubusercontent.com",
};

/**
 * A linked account's picture through Zrzur's media proxy, so viewers never
 * contact the service. Nothing for any other address or without a proxy;
 * the caller then draws a letter.
 */
export function serviceImage(
  client: Pick<Client, "proxyFile">,
  service: string,
  url?: string,
): string | undefined {
  const host = IMAGE_HOSTS[service];
  if (!host || !url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== host) return undefined;
  } catch {
    return undefined;
  }
  return client.proxyFile(url);
}

/** A BattleTag split into the name and its #number */
export function splitBattleTag(tag: string): { name: string; number: string } {
  const at = tag.lastIndexOf("#");
  return at > 0
    ? { name: tag.slice(0, at), number: tag.slice(at) }
    : { name: tag, number: "" };
}
