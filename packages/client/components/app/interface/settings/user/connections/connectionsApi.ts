import type { Client } from "@zrzur/sdk/solid";

import type {
  LinkedAchievement,
  LinkedGame,
} from "@revolt/ui/components/features/profiles/linkedGames";

/**
 * Linked accounts (Steam). Not in the SDK's API document yet (contract
 * request: stream steam-connection): called through `raw()`, with types that
 * mirror the server's `v0` types.
 */

/** The person's Steam link, as they see it in settings */
export type LinkedAccount = {
  service: "steam" | string;
  display_name: string;
  profile_url: string;
  shown: boolean;
  private: boolean;
  game_count?: number;
  total_hours?: number;
  games: LinkedGame[];
  /** Newest first, hidden games included */
  achievements: LinkedAchievement[];
  hidden_titles: number[];
  linked_at: number;
  refreshed_at: number;
  /** Refresh works again from here, milliseconds since the epoch */
  refresh_after: number;
  /** Agreed to the consent text in use; if not, pictures and achievements stay off */
  consent_current: boolean;
};

/** Version of the consent text the app shows */
export const STEAM_CONSENT_VERSION = 2;

export type LinkedAccounts = {
  steam: { available: boolean; account?: LinkedAccount };
};

/** Where Steam sends people back to, in this app */
export const STEAM_RETURN_PATH = "/connections/steam/return";

export const connectionsApi = {
  list: (client: Client) =>
    client.api.raw<LinkedAccounts>("get", "/users/@me/connections"),

  /** Steam's own sign-in page, for this app's origin */
  start: (client: Client, origin: string) =>
    client.api.raw<{ url: string }>(
      "post",
      "/users/@me/connections/steam/start",
      { origin },
    ),

  finish: (client: Client, state: string, params: Record<string, string>) =>
    client.api.raw<LinkedAccount>(
      "post",
      "/users/@me/connections/steam/finish",
      { state, params },
    ),

  edit: (
    client: Client,
    change: { shown?: boolean; hidden_titles?: number[]; consent?: number },
  ) =>
    client.api.raw<LinkedAccount>(
      "patch",
      "/users/@me/connections/steam",
      change,
    ),

  refresh: (client: Client) =>
    client.api.raw<LinkedAccount>(
      "post",
      "/users/@me/connections/steam/refresh",
    ),

  disconnect: (client: Client) =>
    client.api.raw<void>("delete", "/users/@me/connections/steam"),
};

/**
 * What Steam sent back, from the return address: the state, and every
 * `openid.*` field unchanged. Anything else in the address is left out.
 */
export function steamReturnFields(search: string) {
  const query = new URLSearchParams(search);
  const params: Record<string, string> = {};
  for (const [key, value] of query) {
    if (key.startsWith("openid.")) params[key] = value;
  }
  return { state: query.get("state") ?? "", params };
}
