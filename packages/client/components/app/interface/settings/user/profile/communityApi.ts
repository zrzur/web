import type {
  API as APITypes__,
  Client,
  WithoutNull as WithoutNull__,
} from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";

// relative, so unit tests run without the app aliases
import { discoverRequest } from "../../../discover/api";

export type CommunityKind = "decorations" | "nameplates" | "effects";

export type CommunityStatus =
  | "Draft"
  | "PendingReview"
  | "ChangesRequested"
  | "Published"
  | "Rejected"
  | "Suspended"
  | "Archived";

/** A new version of a published design, waiting for review */
export type CommunityRevision = WithoutNull__<APITypes__.CommunityRevision>;

/** A decoration or nameplate made by a creator */
export type CommunityItem = WithoutNull__<APITypes__.CommunityItem>;

/** Who made a design: name and avatar, never `username#tag` */
export type CommunityCreator = Omit<
  WithoutNull__<APITypes__.CommunityCreator>,
  "username" | "discriminator" | "display_name"
> & {
  /** their display name, or their username without the tag */
  display_name?: string;
  /** they opened a page of all their work */
  open_page?: boolean;
};

/** A suspended creator's reason and way to appeal */
export type CreatorStanding = {
  standing: "Active" | "Suspended" | "Revoked";
  reason?: string;
  since?: number;
  action_id?: string;
  can_appeal?: boolean;
  appeal_status?: "Pending" | "Upheld" | "Overturned";
  appeal_note?: string;
};

export type CommunityPage = WithoutNull__<APITypes__.CommunityPage>;

export type CommunityReviewEntry =
  WithoutNull__<APITypes__.CommunityReviewEntry>;

export type CommunityItemDetails =
  WithoutNull__<APITypes__.CommunityItemDetails>;

export type CommunityReviewQueue =
  WithoutNull__<APITypes__.CommunityReviewQueue>;

export type PlatformPermission =
  | "cosmetics.submit"
  | "cosmetics.manage_own"
  | "cosmetics.review"
  | "cosmetics.manage_creators"
  | "cosmetics.manage_all";

export type CommunityPermissions =
  WithoutNull__<APITypes__.CommunityPermissions> & {
    /** shown by name to visitors without an account (default off) */
    show_public_name?: boolean;
  };

export type CreatorRecord = WithoutNull__<APITypes__.CreatorRecord>;

export type CreatorLogEntry = WithoutNull__<APITypes__.CreatorLogEntry>;

/** Community filter chips */
export type CommunityFilter = "all" | "new" | "popular" | "favourites";

/** Formats the server accepts for community images */
export const COMMUNITY_TYPES = [
  "image/png",
  "image/apng",
  "image/gif",
  "image/webp",
  "video/webm",
];

/** Largest WebM going in; the server makes an image of it */
export const COMMUNITY_WEBM_MAX_BYTES = 8_000_000;

/** Largest upload, matches the `decorations` limit on the media server */
export const COMMUNITY_MAX_BYTES = 2_500_000;

/** Largest width or height, matches `features.community.max_dimension` */
export const COMMUNITY_MAX_DIMENSION = 1024;

/** Largest effect, matches the `effects` limit on the media server */
export const EFFECT_MAX_BYTES = 2_000_000;

/** The Creator Terms a creator accepts with an effect (backend constant) */
export const CREATOR_TERMS_VERSION = "2026-11-12";

/** What a creator promises when they send an effect */
export type CommunityRightsInput = {
  confirmed: boolean;
  terms_version: string;
  third_party?: string;
  ai_parts?: string;
};

/** Why the media server refused an effect, by the code it sends */
export type EffectProblem =
  | "flashing"
  | "too_solid"
  | "blank"
  | "unreadable"
  | "not_animated"
  | "repeats"
  | "too_fast"
  | "shape"
  | "too_many_frames"
  | "too_long"
  | "too_many_pixels"
  | "webm"
  | "webm_slow";

const EFFECT_PROBLEMS: readonly string[] = [
  "flashing",
  "too_solid",
  "blank",
  "unreadable",
  "not_animated",
  "repeats",
  "too_fast",
  "shape",
  "too_many_frames",
  "too_long",
  "too_many_pixels",
  "webm",
  "webm_slow",
];

/** The refusal in an upload's error, if it is one an effect can get */
export function effectProblem(error: unknown): EffectProblem | undefined {
  const { fields } = (error ?? {}) as { fields?: { rule?: string }[] };
  const found = fields
    ?.map((entry) => entry.rule)
    .find((rule) => rule && EFFECT_PROBLEMS.includes(rule));
  return found as EffectProblem | undefined;
}

/** Query parameters for a gallery filter, search and page */
export function communityParams(
  filter: CommunityFilter,
  query: string,
  offset = 0,
  limit = 60,
) {
  return {
    query: query.trim() || undefined,
    sort: filter === "popular" ? "popular" : undefined,
    favourites: filter === "favourites" ? true : undefined,
    limit,
    offset: offset || undefined,
  };
}

/** Name to show for a creator: display name, else username (staff views) */
export function creatorName(creator?: {
  display_name?: string;
  username?: string;
}) {
  return creator?.display_name || creator?.username || "";
}

/** `@username#1234` handle of an account, in staff views only */
export function creatorHandle(creator?: {
  username: string;
  discriminator: string;
}) {
  return creator ? `@${creator.username}#${creator.discriminator}` : "";
}

/** Link to a creator's page only if they opened it */
export function hasOpenPage(creator?: CommunityCreator) {
  return !!creator?.open_page;
}

/** Whether the permission list allows something */
export function can(
  perms: CommunityPermissions | undefined,
  permission: PlatformPermission,
) {
  return !!perms?.permissions.includes(permission);
}

/**
 * May publish designs: an active creator. The right to submit alone is not
 * the rank: privileged accounts hold every permission with no creator record.
 */
export function mayCreate(perms: CommunityPermissions | undefined) {
  return perms?.creator === "Active" && can(perms, "cosmetics.submit");
}

/**
 * May open the studio: active creators to work, and suspended creators to
 * see their own designs, read-only. Revoked
 * creators stay out.
 */
export function maySeeStudio(perms: CommunityPermissions | undefined) {
  return mayCreate(perms) || perms?.creator === "Suspended";
}

/** Creator Studio tabs and which statuses go in them */
/**
 * Creators publish directly, so the studio only has drafts and published
 * designs. Items sent back by reviewers before that (or still waiting)
 * count as drafts the creator can publish.
 */
export const STUDIO_TABS = {
  drafts: ["Draft", "PendingReview", "ChangesRequested", "Rejected"],
  published: ["Published", "Suspended"],
} as const satisfies Record<string, CommunityStatus[]>;

export type StudioTab = keyof typeof STUDIO_TABS;

/**
 * Sort a creator's own designs into the studio tabs. A published design
 * with an unpublished new version also shows under drafts.
 */
export function studioBuckets(items: CommunityItem[]) {
  const buckets: Record<StudioTab, CommunityItem[]> = {
    drafts: [],
    published: [],
  };
  for (const item of items) {
    for (const [tab, statuses] of Object.entries(STUDIO_TABS) as [
      StudioTab,
      readonly CommunityStatus[],
    ][]) {
      if (statuses.includes(item.status)) buckets[tab].push(item);
      if (
        item.pending &&
        tab !== "published" &&
        statuses.includes(item.pending.status)
      ) {
        buckets[tab].push(item);
      }
    }
  }
  return buckets;
}

/** Why a picked file can't be used, before uploading it */
export function checkCommunityFile(
  file: { type: string; size: number },
  kind: CommunityKind = "decorations",
) {
  if (!COMMUNITY_TYPES.includes(file.type)) return "type" as const;
  if (file.type === "video/webm")
    return file.size > COMMUNITY_WEBM_MAX_BYTES
      ? ("webm-size" as const)
      : undefined;
  const limit = kind === "effects" ? EFFECT_MAX_BYTES : COMMUNITY_MAX_BYTES;
  if (file.size > limit) return "size" as const;
  return undefined;
}

/** The kind of a community item, as the address it is listed under */
export const kindOf = (item: { kind: string }): CommunityKind =>
  item.kind === "Nameplate"
    ? "nameplates"
    : item.kind === "Effect"
      ? "effects"
      : "decorations";

/**
 * Whether a design's image has the right shape for where it is shown. Only
 * advice: the server accepts other shapes.
 */
export function artFit(kind: CommunityKind, width: number, height: number) {
  const ratio = width / height;
  if (kind === "decorations")
    return Math.abs(ratio - 1) > 0.02 ? ("square" as const) : undefined;
  // the server refuses anything else for an effect
  if (kind === "effects")
    return Math.abs(ratio - 9 / 16) > 0.012 ? ("tall" as const) : undefined;
  return ratio < 4 || ratio > 7 ? ("wide" as const) : undefined;
}

/** Error `type` from an API error body, if any */
export function communityErrorType(error: unknown) {
  try {
    const body = typeof error === "string" ? JSON.parse(error) : error;
    return (body as { type?: string })?.type;
  } catch {
    return undefined;
  }
}

/** The server turned this down over the rank, whatever the app showed */
export function isRankRefusal(error: unknown) {
  return communityErrorType(error) === "MissingPlatformPermission";
}

/** Tags typed as "fire, ice  glow" */
export function parseTags(text: string) {
  return [
    ...new Set(
      text
        .split(/[,،\s]+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 8);
}

const id = (value: string) => encodeURIComponent(value);

export const communityApi = {
  permissions: (client: Client) =>
    client.api.get("/community/permissions").then(withoutNull),

  list: (
    client: Client,
    kind: CommunityKind,
    params: Partial<ReturnType<typeof communityParams>> & { creator?: string },
  ) => client.api.get(`/community/${kind}`, params).then(withoutNull),

  details: (client: Client, itemId: string) =>
    client.api.get(`/community/items/${id(itemId)}`).then(withoutNull),

  favourite: (client: Client, itemId: string, on: boolean) =>
    on
      ? client.api
          .put(`/community/items/${id(itemId)}/favourite`)
          .then(withoutNull)
      : client.api
          .delete(`/community/items/${id(itemId)}/favourite`)
          .then(withoutNull),

  report: (client: Client, itemId: string) =>
    client.api.post(`/community/items/${id(itemId)}/report`).then(withoutNull),

  /** A creator's choice: show my name on the public Designs site */
  setPublicName: (client: Client, show: boolean) =>
    discoverRequest<void>(
      client,
      "PUT",
      "/community/creators/@me/public-name",
      {
        body: { show_public_name: show },
      },
    ),

  creator: (client: Client, userId: string) =>
    client.api.get(`/community/creators/${id(userId)}`).then(withoutNull),

  /** What someone published, for their profile; works with their page closed */
  creations: (client: Client, userId: string) =>
    client.api
      .get(`/community/creators/${id(userId)}/designs`)
      .then((items) => items.map((item) => withoutNull(item))),

  /** Why a creator is suspended, and whether they can appeal */
  standing: (client: Client) =>
    discoverRequest<CreatorStanding>(
      client,
      "GET",
      "/community/creators/@me/standing",
    ),

  /** Save your own copy of a design; works while suspended too */
  download: async (client: Client, itemId: string) => {
    const copy = await discoverRequest<{ url: string; filename: string }>(
      client,
      "GET",
      `/community/items/${id(itemId)}/download`,
    );
    const url = await fetchPrivateImage(client, copy.url);
    const link = document.createElement("a");
    link.href = url;
    link.download = copy.filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  // creators
  mine: (client: Client) => client.api.get("/community/mine").then(withoutNull),

  create: (
    client: Client,
    kind: CommunityKind,
    body: {
      name: string;
      file: string;
      description?: string;
      tags?: string[];
      submit?: boolean;
      rights?: CommunityRightsInput;
    },
  ) => client.api.post(`/community/${kind}`, body).then(withoutNull),

  edit: (
    client: Client,
    itemId: string,
    body: {
      name?: string;
      file?: string;
      description?: string;
      tags?: string[];
      submit?: boolean;
      rights?: CommunityRightsInput;
    },
  ) =>
    client.api.patch(`/community/items/${id(itemId)}`, body).then(withoutNull),

  submit: (client: Client, itemId: string) =>
    client.api.post(`/community/items/${id(itemId)}/submit`).then(withoutNull),

  archive: (client: Client, itemId: string) =>
    client.api.post(`/community/items/${id(itemId)}/archive`).then(withoutNull),

  // reviewers
  queue: (client: Client) =>
    client.api.get("/community/review").then(withoutNull),

  decide: (
    client: Client,
    itemId: string,
    action: "approve" | "reject" | "request-changes" | "suspend" | "override",
    reason?: string,
    version?: number,
  ) =>
    client.api
      .post(`/community/items/${id(itemId)}/${action}`, {
        reason: reason?.trim() || undefined,
        version,
      })
      .then(withoutNull),

  // admins
  creators: (client: Client, query?: string) =>
    client.api.get("/admin/creators", { query }).then(withoutNull),

  creatorAction: (
    client: Client,
    user: string,
    action: "grant" | "revoke" | "suspend" | "reinstate",
    reason?: string,
  ) =>
    client.api
      .post("/admin/creators", {
        user,
        action,
        reason: reason?.trim() || undefined,
      })
      .then(withoutNull),

  creatorHistory: (client: Client, user: string) =>
    client.api.get(`/admin/creators/${id(user)}/history`).then(withoutNull),

  setPermissions: (
    client: Client,
    user: string,
    permissions: string[],
    reason?: string,
  ) =>
    client.api
      .post("/admin/permissions", {
        user,
        permissions,
        reason: reason?.trim() || undefined,
      })
      .then(withoutNull),
};

/**
 * Load a design that isn't public yet (a draft, or one in review). The
 * media server only hands those to their creator and reviewers, so the
 * request carries the session; the result is a local object URL.
 */
export async function fetchPrivateImage(
  client: Client,
  url: string,
): Promise<string> {
  const headers = client.api.config.headers;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(String(response.status));
  return URL.createObjectURL(await response.blob());
}
