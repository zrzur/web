import type { API, Client } from "@zrzur/sdk/solid";

/**
 * Discover is served by the Zrzur API (`/discover/*`, plus the owner
 * routes under `/servers/:id/discover` and `/bots/:id/discover`). It never
 * embeds or contacts upstream Stoat/Revolt Discover sites.
 */

export type DiscoverKind = "servers" | "bots";

export type DiscoverServer = {
  _id: string;
  name: string;
  description?: string;
  icon?: API.File;
  banner?: API.File;
  flags?: number;
  nsfw: boolean;
  member_count: number;
  /** Approximate, cached; missing for very large servers */
  online_count?: number;
  /** Custom link name (zrzur.cc/<link>, discover.zrzur.com/<link>) */
  link?: string;
  tags: string[];
  category?: string;
  language?: string;
  featured: boolean;
  /** Biggest running paid boost */
  boost?: "Boost" | "SuperBoost" | "MegaBoost";
  /** In the paid top row */
  promoted?: boolean;
};

/** The paid top row of bots */
export type DiscoverPromotedBots = {
  slots: number;
  open: number;
  bots: DiscoverBot[];
};

/** The paid top row */
export type DiscoverPromotedRow = {
  slots: number;
  open: number;
  servers: DiscoverServer[];
};

export type DiscoverBot = {
  _id: string;
  username: string;
  avatar?: API.File;
  banner?: API.File;
  description?: string;
  server_count: number;
  /** Verified by Trust & Safety */
  verified?: boolean;
  tags: string[];
  category?: string;
  language?: string;
  featured: boolean;
  /** Biggest running paid boost */
  boost?: "Boost" | "SuperBoost" | "MegaBoost";
  /** In the paid top row */
  promoted?: boolean;
};

/** What a bot's public invite says about it */
export type BotInvite = {
  default_permissions?: number;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
};

export type DiscoverStatus =
  | "Pending"
  | "UnderReview"
  | { Approved: string | null }
  | { Denied: string | null }
  | { Removed: string | null };

export type DiscoverRequest = {
  type: "Server" | "Bot";
  id: string;
  status: DiscoverStatus;
  tags?: string[];
  category?: string;
  language?: string;
  featured: boolean;
};

export type DiscoverQueueEntry = {
  request: DiscoverRequest;
  name: string;
  description?: string;
  icon?: API.File;
  owner: string;
  count: number;
};

export type DiscoverListing = {
  tags?: string[];
  category?: string;
  language?: string;
};

export type DiscoverQuery = {
  query?: string;
  category?: string;
  tag?: string;
  language?: string;
  featured?: boolean;
  sort?: "popular" | "new";
  limit?: number;
  offset?: number;
};

export type Decision = "Review" | "Approve" | "Deny" | "Remove";

/** Reduce a request status to one word for switches */
export function statusKind(
  status: DiscoverStatus,
): "pending" | "review" | "approved" | "denied" | "removed" {
  if (status === "Pending") return "pending";
  if (status === "UnderReview") return "review";
  if ("Approved" in status) return "approved";
  if ("Denied" in status) return "denied";
  return "removed";
}

export function statusReason(status: DiscoverStatus): string | null {
  if (typeof status !== "object") return null;
  return Object.values(status)[0] ?? null;
}

type RawApi = {
  baseURL: string;
  config: { headers?: Record<string, string> };
};

/**
 * stoat-api drops query parameters and bodies for routes missing from its
 * generated route table, so Discover builds its own requests (same base
 * URL and session headers; errors are thrown in the same shape).
 */
export async function discoverRequest<T = unknown>(
  client: Client,
  method: "GET" | "PUT" | "PATCH" | "POST" | "DELETE",
  path: string,
  options: { params?: Record<string, unknown>; body?: unknown } = {},
  retries = 2,
): Promise<T> {
  const api = client.api as unknown as RawApi;
  const url = new URL(api.baseURL + path);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...api.config.headers,
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Owner actions come in quick succession; wait out short rate limits
  if (response.status === 429 && retries > 0) {
    const wait = Number(response.headers.get("X-Ratelimit-Reset-After"));
    if (wait > 0 && wait <= 15_000) {
      await new Promise((resolve) => setTimeout(resolve, wait + 50));
      return discoverRequest(client, method, path, options, retries - 1);
    }
  }

  const text = await response.text();
  if (!response.ok) throw text;
  return (text ? JSON.parse(text) : undefined) as T;
}

export const discoverApi = {
  servers: (client: Client, query: DiscoverQuery) =>
    discoverRequest<DiscoverServer[]>(client, "GET", "/discover/servers", {
      params: query,
    }),
  bots: (client: Client, query: DiscoverQuery) =>
    discoverRequest<DiscoverBot[]>(client, "GET", "/discover/bots", {
      params: query,
    }),
  server: (client: Client, id: string) =>
    discoverRequest<DiscoverServer>(client, "GET", `/discover/servers/${id}`),
  bot: (client: Client, id: string) =>
    discoverRequest<DiscoverBot>(client, "GET", `/discover/bots/${id}`),
  /** The bot's public invite: the permissions it asks for, its legal links */
  botInvite: (client: Client, id: string) =>
    discoverRequest<BotInvite>(client, "GET", `/bots/${id}/invite`),
  queue: (client: Client) =>
    discoverRequest<DiscoverQueueEntry[]>(client, "GET", "/discover/requests"),
  decide: (
    client: Client,
    entry: Pick<DiscoverRequest, "type" | "id">,
    body: { decision?: Decision; reason?: string; featured?: boolean },
  ) =>
    discoverRequest(
      client,
      "POST",
      `/discover/requests/${entry.type.toLowerCase()}/${entry.id}`,
      { body },
    ),

  /** Owner routes; `kind` is the item's collection */
  status: (client: Client, kind: DiscoverKind, id: string) =>
    discoverRequest<DiscoverRequest>(client, "GET", `/${kind}/${id}/discover`),
  submit: (
    client: Client,
    kind: DiscoverKind,
    id: string,
    listing: DiscoverListing,
  ) =>
    discoverRequest<DiscoverRequest>(client, "PUT", `/${kind}/${id}/discover`, {
      body: listing,
    }),
  edit: (
    client: Client,
    kind: DiscoverKind,
    id: string,
    listing: DiscoverListing,
  ) =>
    discoverRequest<DiscoverRequest>(
      client,
      "PATCH",
      `/${kind}/${id}/discover`,
      { body: listing },
    ),
  withdraw: (client: Client, kind: DiscoverKind, id: string) =>
    discoverRequest(client, "DELETE", `/${kind}/${id}/discover`),

  /** Paid top row */
  promoted: (client: Client) =>
    discoverRequest<DiscoverPromotedRow>(client, "GET", "/discover/promoted"),
  /** Paid top row of bots */
  promotedBots: (client: Client) =>
    discoverRequest<DiscoverPromotedBots>(
      client,
      "GET",
      "/discover/promoted/bots",
    ),
  /** Count a view (top row) or click (opened) for a promoted listing */
  event: (
    client: Client,
    kind: DiscoverKind,
    id: string,
    action: "view" | "click",
  ) =>
    discoverRequest(client, "POST", `/discover/${kind}/${id}/events`, {
      body: { kind: action },
    }),
};

/** Deterministic hue for items without a banner */
export function hueFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
