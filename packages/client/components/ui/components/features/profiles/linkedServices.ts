import type { UserProfile } from "@zrzur/sdk/solid";

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
