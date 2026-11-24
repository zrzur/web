import type { API as APITypes__, WithoutNull as WithoutNull__ } from "@zrzur/sdk/solid";
import type { API, Client } from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";

// relative, so unit tests run without the app aliases
import type { CommunityCreator } from "../profile/communityApi";

export type OwnBadge = WithoutNull__<APITypes__.OwnBadge>;

export type BetaStatus =
  | "Requested"
  | "Invited"
  | "Active"
  | "Removed"
  | "Completed";

export type BetaMembership = WithoutNull__<APITypes__.BetaMembership>;

export type MyBadges = WithoutNull__<APITypes__.MyBadges>;

export type BadgeInfo = WithoutNull__<APITypes__.BadgeInfo>;

export type AdminBadgeGrant = WithoutNull__<APITypes__.AdminBadgeGrant>;

export type BadgeLogEntry = WithoutNull__<APITypes__.BadgeLogEntry>;

export type AdminUserBadges = WithoutNull__<APITypes__.AdminUserBadges>;

export type BadgeHolder = WithoutNull__<APITypes__.BadgeHolder>;

export type BetaFeature = WithoutNull__<APITypes__.BetaFeature>;

export type BetaMemberRecord = WithoutNull__<APITypes__.BetaMemberRecord>;

export type BugStatus =
  | "Open"
  | "Triaged"
  | "NeedsInfo"
  | "Confirmed"
  | "Fixed"
  | "Duplicate"
  | "NotABug";

export type BugReport = WithoutNull__<APITypes__.BugReport>;

export type BugReportReview = WithoutNull__<APITypes__.BugReportReview>;

export type NewBugReport = {
  kind: "bug" | "security" | "feedback";
  title: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  platform: string;
  device?: string;
  app_version?: string;
  feature?: string;
  attachments?: string[];
};

export type BugReviewAction =
  | "triage"
  | "need_info"
  | "confirm"
  | "fix"
  | "duplicate"
  | "not_a_bug"
  | "reopen";

export const badgesApi = {
  catalogue: (client: Client) =>
    client.api.get("/badges/catalogue").then(withoutNull),
  mine: (client: Client) => client.api.get("/badges/@me").then(withoutNull),
  setHidden: (client: Client, badge: string, hidden: boolean) =>
    client.api.patch(`/badges/@me/${badge}`, { hidden }).then(withoutNull),
  /** Read only (the beta tools look people up with it) */
  search: (client: Client, query: string, badge?: string) =>
    client.api.get("/badges/admin/users", { query, badge }).then(withoutNull),
};

/** A row of the staff user directory (`GET /staff/users`) */
export type StaffUserRow = {
  id: string;
  username: string;
  discriminator: string;
  display_name?: string | null;
  bot: boolean;
  deleted: boolean;
};

/** A badge change waiting for a second staff member */
export type BadgeRequest = {
  id: string;
  user_id: string;
  badge: string;
  /** true: give, false: take away */
  grant: boolean;
  reason: string;
  requested_by: string;
  status: "Pending" | "Approved" | "Refused" | "Expired";
  created_at: number;
  expires_at: number;
};

/** What a grant or revoke did: made now, or waiting for a second person */
export type StaffBadgeChange = {
  status: "applied" | "pending";
  request?: BadgeRequest;
};

/** Header that carries the staff session */
const STAFF_HEADER = "x-staff-session";

/**
 * Open a staff session with an authenticator code, as the admin console
 * does. The token lives in memory only, for this panel.
 */
export const openStaffSession = (client: Client, totpCode: string) =>
  client.api.raw<{ token: string; expires_at: number }>(
    "post",
    "/staff/session",
    { totp_code: totpCode },
  );

/**
 * The admin console's badge routes, with a staff session. Every change goes
 * through the server's one badge gate: Founder never, Staff and Platform
 * Moderator only by appointment, retired badges never, sensitive changes
 * wait for a second staff member, protected ones need a fresh code.
 */
export function staffBadgesApi(client: Client, token: string) {
  const call = <T>(
    method: "get" | "post" | "delete",
    path: string,
    body?: unknown,
  ) =>
    client.api.raw<T>(method, path, body, {
      headers: { [STAFF_HEADER]: token },
    });
  return {
    search: (query: string) =>
      call<StaffUserRow[]>("get", "/staff/users", { q: query, limit: 20 }),
    user: (id: string) =>
      call<AdminUserBadges>("get", `/staff/users/${id}/badges`),
    grant: (id: string, badge: string, reason: string, expiresAt?: number) =>
      call<StaffBadgeChange>("post", `/staff/users/${id}/badges/grant`, {
        badge,
        reason,
        expires_at: expiresAt,
      }),
    revoke: (id: string, badge: string, reason: string) =>
      call<StaffBadgeChange>("post", `/staff/users/${id}/badges/revoke`, {
        badge,
        reason,
      }),
    requests: () => call<BadgeRequest[]>("get", "/staff/badges/requests"),
    approve: (id: string) =>
      call<StaffBadgeChange>("post", `/staff/badges/requests/${id}/approve`),
    refuse: (id: string) =>
      call<BadgeRequest>("post", `/staff/badges/requests/${id}/refuse`),
    stepUp: (totpCode: string) =>
      call<{ step_up_until: number }>("post", "/staff/session/step-up", {
        totp_code: totpCode,
      }),
    close: () => call<void>("delete", "/staff/session"),
  };
}

export const betaApi = {
  me: (client: Client) => client.api.get("/beta/@me").then(withoutNull),
  request: (client: Client) =>
    client.api.post("/beta/@me/request").then(withoutNull),
  accept: (client: Client) =>
    client.api.post("/beta/@me/accept").then(withoutNull),
  leave: (client: Client) =>
    client.api.post("/beta/@me/leave").then(withoutNull),
  access: (client: Client, feature: string) =>
    client.api.get(`/beta/features/${feature}`).then(withoutNull),
  features: (client: Client) =>
    client.api.get("/beta/admin/features").then(withoutNull),
  saveFeature: (
    client: Client,
    feature: {
      id: string;
      name: string;
      description?: string;
      enabled: boolean;
      all_testers: boolean;
    },
  ) => client.api.post("/beta/admin/features", feature).then(withoutNull),
  members: (client: Client, status?: BetaStatus) =>
    client.api.get("/beta/admin/members", { status }).then(withoutNull),
  member: (
    client: Client,
    user: string,
    action: "invite" | "approve" | "remove" | "complete" | "features",
    features?: string[],
    note?: string,
  ) =>
    client.api
      .post("/beta/admin/members", { user, action, features, note })
      .then(withoutNull),
};

export const bugsApi = {
  submit: (client: Client, report: NewBugReport) =>
    client.api.post("/bugs/", report).then(withoutNull),
  mine: (client: Client) => client.api.get("/bugs/@me").then(withoutNull),
  fetch: (client: Client, id: string) =>
    client.api.get(`/bugs/${id}`).then(withoutNull),
  queue: (client: Client, status?: string, security?: boolean) =>
    client.api.get("/bugs/admin/queue", { status, security }).then(withoutNull),
  review: (
    client: Client,
    id: string,
    review: {
      action: BugReviewAction;
      note?: string;
      severity?: string;
      duplicate_of?: string;
      updated_at: number;
    },
  ) => client.api.post(`/bugs/admin/${id}/review`, review).then(withoutNull),
};

/** Platform this client runs on, for bug reports */
export function currentPlatform(): string {
  const native = (window as unknown as { native?: unknown }).native;
  if (!native) return "web";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "desktop-windows";
  if (/Mac OS/i.test(ua)) return "desktop-macos";
  if (/Linux/i.test(ua)) return "desktop-linux";
  return "other";
}

export const can = (badges: MyBadges | undefined, permission: string) =>
  !!badges && (badges.privileged || badges.permissions.includes(permission));
