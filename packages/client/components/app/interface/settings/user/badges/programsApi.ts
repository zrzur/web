import type { Client } from "@zrzur/sdk/solid";

import type { AnyBadgeId } from "@revolt/ui/components/features/profiles/badges/catalog";

/**
 * Badge programs people apply for: Zrzur Partner, Verified Server,
 * Verified Bot Developer and Content Creator. The SDK pin does not carry
 * these routes yet, so they are typed here from the backend contract
 * (`/badges/programs/*`, `/badges/applications/*`). Applying is open only
 * while the server reports `badge_applications` (off by default).
 */

export type ProgramId =
  | "partner"
  | "verified_server"
  | "verified_bot"
  | "content_creator";

/** The badge each program leads to, as the catalogue names it */
export const PROGRAM_BADGE: Record<ProgramId, AnyBadgeId> = {
  partner: "partner",
  // the server's mark: Verified Server Owner is cancelled (owner, 2026-11-24)
  verified_server: "server_verified",
  verified_bot: "verified_bot_developer",
  content_creator: "content_creator",
};

/** Whether this server lets people apply from the app (`GET /` features) */
export function applicationsOpen(client: Client | undefined): boolean {
  const features = client?.configuration?.features as
    | { badge_applications?: boolean }
    | undefined;
  return features?.badge_applications === true;
}

/** Content Creator: platforms, named in plain text (never a logo) */
export const CREATOR_PLATFORMS = [
  "youtube",
  "tiktok",
  "twitch",
  "instagram",
  "x",
  "kick",
  "facebook",
  "other",
] as const;
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];

/** Content Creator: kinds of content (a genre is never a reason to refuse) */
export const CREATOR_CATEGORIES = [
  "education",
  "technology",
  "gaming",
  "livestream",
  "tutorials",
  "creative",
  "comedy",
  "art",
  "film",
  "commentary",
  "other",
] as const;
export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];

/** Content Creator: the one channel or profile an application is about */
export type CreatorChannel = {
  platform: CreatorPlatform;
  platform_name?: string;
  url: string;
  category: CreatorCategory;
  works: string[];
  schedule?: string;
};

/** The program behind a badge, if people apply for it */
export function programOf(badge: string): ProgramId | undefined {
  return (Object.keys(PROGRAM_BADGE) as ProgramId[]).find(
    (program) => PROGRAM_BADGE[program] === badge,
  );
}

export type ProgramCheck = {
  code: string;
  /** missing: a person checks it */
  met?: boolean;
  value?: number;
  needed?: number;
};

export type ProgramEligibility = {
  program: ProgramId;
  target_id: string;
  checks: ProgramCheck[];
  can_apply: boolean;
  blocked?: string;
  blocked_until?: number;
};

export type ProgramTarget = {
  id: string;
  name: string;
  kind: "server" | "bot";
};

export type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "InReview"
  | "MoreInfo"
  | "Approved"
  | "Refused"
  | "Withdrawn"
  | "Ended";

export type BadgeApplication = {
  _id: string;
  program: ProgramId;
  target_id: string;
  target_name?: string;
  status: ApplicationStatus;
  exception: boolean;
  statement: string;
  links: string[];
  authorized: boolean;
  ownership?: {
    method: "dns" | "website" | "profile";
    domain: string;
    record_name: string;
    file_url: string;
    expires_at: number;
    verified_at?: number;
  };
  creator?: CreatorChannel;
  checks: ProgramCheck[];
  created_at: number;
  submitted_at?: number;
  decided_at?: number;
  reasons: string[];
  note?: string;
  reapply_after?: number;
  appeal_until?: number;
  appeal?: {
    status: "Open" | "Upheld" | "Rejected";
    created_at: number;
    decided_at?: number;
    reasons: string[];
    note?: string;
  };
  next_review_at?: number;
  improve_until?: number;
  ended_at?: number;
  end_reason?: string;
  evidence: {
    _id: string;
    kind: "link" | "note";
    text: string;
    created_at: number;
  }[];
};

type RawApi = {
  get(path: string, params?: object): Promise<unknown>;
  post(path: string, body?: object): Promise<unknown>;
  patch(path: string, body?: object): Promise<unknown>;
};

const raw = (client: Client) => client.api as unknown as RawApi;

export const programsApi = {
  targets: (client: Client) =>
    raw(client).get("/badges/programs/targets") as Promise<ProgramTarget[]>,
  eligibility: (
    client: Client,
    program: ProgramId,
    target: string,
    exception = false,
  ) =>
    raw(client).get(`/badges/programs/${program}/eligibility`, {
      target,
      ...(exception ? { exception: true } : {}),
    }) as Promise<ProgramEligibility>,
  mine: (client: Client) =>
    raw(client).get("/badges/applications/@me") as Promise<BadgeApplication[]>,
  create: (
    client: Client,
    body: {
      program: ProgramId;
      target_id: string;
      exception?: boolean;
      statement?: string;
      links?: string[];
      authorized?: boolean;
      creator?: CreatorChannel;
    },
  ) =>
    raw(client).post("/badges/applications", body) as Promise<BadgeApplication>,
  edit: (
    client: Client,
    id: string,
    body: {
      statement?: string;
      links?: string[];
      authorized?: boolean;
      creator?: CreatorChannel;
    },
  ) =>
    raw(client).patch(
      `/badges/applications/${id}`,
      body,
    ) as Promise<BadgeApplication>,
  addEvidence: (
    client: Client,
    id: string,
    kind: "link" | "note",
    text: string,
  ) =>
    raw(client).post(`/badges/applications/${id}/evidence`, {
      kind,
      text,
    }) as Promise<BadgeApplication>,
  challenge: (
    client: Client,
    id: string,
    method: "dns" | "website" | "profile",
    domain: string,
  ) =>
    raw(client).post(`/badges/applications/${id}/ownership`, {
      method,
      domain,
    }) as Promise<{ application: BadgeApplication; value: string }>,
  verifyOwnership: (client: Client, id: string) =>
    raw(client).post(
      `/badges/applications/${id}/ownership/verify`,
    ) as Promise<BadgeApplication>,
  submit: (client: Client, id: string) =>
    raw(client).post(
      `/badges/applications/${id}/submit`,
    ) as Promise<BadgeApplication>,
  withdraw: (client: Client, id: string) =>
    raw(client).post(
      `/badges/applications/${id}/withdraw`,
    ) as Promise<BadgeApplication>,
  appeal: (client: Client, id: string, text: string) =>
    raw(client).post(`/badges/applications/${id}/appeal`, {
      text,
    }) as Promise<BadgeApplication>,
};

/** The code of a `FailedValidation` answer from these routes, if any */
export function failureCode(failure: unknown): string | undefined {
  let error = failure as
    | { type?: unknown; error?: unknown }
    | string
    | undefined;
  if (typeof error === "string") {
    try {
      error = JSON.parse(error) as { type?: unknown; error?: unknown };
    } catch {
      return undefined;
    }
  }
  return error?.type === "FailedValidation" && typeof error.error === "string"
    ? error.error
    : undefined;
}
