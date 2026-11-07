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
  search: (client: Client, query: string, badge?: string) =>
    client.api.get("/badges/admin/users", { query, badge }).then(withoutNull),
  user: (client: Client, id: string) =>
    client.api.get(`/badges/admin/users/${id}`).then(withoutNull),
  grant: (
    client: Client,
    user: string,
    badge: string,
    reason: string,
    expires_at?: number,
  ) =>
    client.api
      .post("/badges/admin/grant", { user, badge, reason, expires_at })
      .then(withoutNull),
  revoke: (client: Client, user: string, badge: string, reason: string) =>
    client.api
      .post("/badges/admin/revoke", { user, badge, reason })
      .then(withoutNull),
};

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
