import type { Client } from "@zrzur/sdk/solid";

import type { LinkedRepo } from "@revolt/ui/components/features/profiles/linkedServices";

/**
 * Twitch, GitHub and Battle.net: linked through the service's own sign-in
 * page. Not in the SDK's API document yet (contract request: stream
 * more-connections), so called through `raw()`, with types that mirror the
 * server's `v0` types.
 */

export const SERVICE_IDS = ["twitch", "github", "battlenet"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export function isServiceId(id: string | undefined): id is ServiceId {
  return (SERVICE_IDS as readonly string[]).includes(id ?? "");
}

/** A linked account as its owner sees it in settings */
export type ServiceAccount = {
  service: ServiceId;
  display_name: string;
  /** Empty for Battle.net */
  profile_url: string;
  shown: boolean;
  /** Twitch */
  live?: boolean;
  live_title?: string;
  /** GitHub: most starred public repositories */
  repos?: LinkedRepo[];
  /** GitHub: ids of the ones that show, in order */
  shown_repos?: number[];
  /** Battle.net: stops showing then, until confirmed again (ms) */
  expires_at?: number;
  linked_at: number;
  refreshed_at: number;
  /** GitHub: Refresh works again from here (ms) */
  refresh_after: number;
  /**
   * Agreed to the consent text in use (it names the US transfer). When
   * false: Twitch is hidden and not read, GitHub Refresh waits. Missing from
   * servers before that text: treated as agreed.
   */
  consent_current?: boolean;
};

/**
 * Version of the consent text the app shows before linking any service,
 * Steam included. 3 added the US transfer and the beliefs, health and
 * sexuality line.
 */
export const LINKED_CONSENT_VERSION = 3;

/** The person still has to agree to the consent text in use */
export const needsConsent = (account: { consent_current?: boolean }) =>
  account.consent_current === false;

export type ServiceConnection = { available: boolean; account?: ServiceAccount };

/** Repositories a person can show at most */
export const MAX_SHOWN_REPOS = 6;

const base = (service: ServiceId) => `/users/@me/connections/${service}` as const;

export const serviceConnectionsApi = {
  /** The service's own sign-in page, for this app's origin */
  start: (client: Client, service: ServiceId, origin: string) =>
    client.api.raw<{ url: string }>("post", `${base(service)}/start`, {
      origin,
    }),

  finish: (client: Client, service: ServiceId, state: string, code: string) =>
    client.api.raw<ServiceAccount>("post", `${base(service)}/finish`, {
      state,
      code,
    }),

  edit: (
    client: Client,
    service: ServiceId,
    change: { shown?: boolean; shown_repos?: number[]; consent?: number },
  ) => client.api.raw<ServiceAccount>("patch", base(service), change),

  refresh: (client: Client, service: ServiceId) =>
    client.api.raw<ServiceAccount>("post", `${base(service)}/refresh`),

  disconnect: (client: Client, service: ServiceId) =>
    client.api.raw<void>("delete", base(service)),
};

/**
 * What the service sent back in the return address: the state and code, or
 * the error when the person said no there. Anything else is left out.
 */
export function serviceReturnFields(search: string) {
  const query = new URLSearchParams(search);
  return {
    state: query.get("state") ?? "",
    code: query.get("code") ?? "",
    denied: query.has("error"),
  };
}

/** Whole days from now until `until` (ms), never below zero */
export function daysLeft(until: number, now: number) {
  return Math.max(0, Math.ceil((until - now) / 86_400_000));
}

/** GitHub: the shown list with one repository switched on or off */
export function toggleRepo(shown: number[], id: number, on: boolean) {
  if (!on) return shown.filter((other) => other !== id);
  if (shown.includes(id) || shown.length >= MAX_SHOWN_REPOS) return shown;
  return [...shown, id];
}
