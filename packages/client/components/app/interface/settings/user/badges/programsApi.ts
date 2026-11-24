import type { Client } from "@zrzur/sdk/solid";

import type { AnyBadgeId } from "@revolt/ui/components/features/profiles/badges/catalog";

/**
 * Badge programs people apply for: Zrzur Partner, Verified Server and
 * Verified Bot Developer. The SDK pin does not carry these routes yet, so
 * they are typed here from the backend contract (`/badges/programs/*`,
 * `/badges/applications/*`).
 */

export type ProgramId = "partner" | "verified_server" | "verified_bot";

/** The badge each program leads to, as the catalogue names it */
export const PROGRAM_BADGE: Record<ProgramId, AnyBadgeId> = {
  partner: "partner",
  verified_server: "verified_server_owner",
  verified_bot: "verified_bot_developer",
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
    method: "dns" | "website";
    domain: string;
    record_name: string;
    file_url: string;
    expires_at: number;
    verified_at?: number;
  };
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
    },
  ) =>
    raw(client).post("/badges/applications", body) as Promise<BadgeApplication>,
  edit: (
    client: Client,
    id: string,
    body: { statement?: string; links?: string[]; authorized?: boolean },
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
    method: "dns" | "website",
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
