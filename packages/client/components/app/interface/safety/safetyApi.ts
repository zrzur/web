import type {
  API as APITypes__,
  Client,
  WithoutNull as WithoutNull__,
} from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";

/**
 * Zrzur Trust & Safety API (`/safety/...`). Types mirror
 * `revolt_models::v0::trust_safety` in the backend.
 */

export type SafetyTargetKind = WithoutNull__<APITypes__.SafetyTargetKind>;

export type SafetyProfileFacet = WithoutNull__<APITypes__.SafetyProfileFacet>;

export type SafetyCategory = WithoutNull__<APITypes__.SafetyCategory>;

export type SafetyStatus = WithoutNull__<APITypes__.SafetyStatus>;

export type SafetyPriority = WithoutNull__<APITypes__.SafetyPriority>;

export type SafetyReceiptStatus = WithoutNull__<APITypes__.SafetyReceiptStatus>;

export type SafetyActionKind = WithoutNull__<APITypes__.SafetyActionKind>;

export type SafetyAppealStatus = WithoutNull__<APITypes__.SafetyAppealStatus>;

export type SafetyStandingLevel = WithoutNull__<APITypes__.SafetyStandingLevel>;

/** Where people write about decisions, appeals and reports (one place) */
export const CONTACT_EMAIL = "support@zrzur.com";

/** Short reference of a decision, as quoted in the e-mail */
export const decisionReference = (actionId: string) =>
  `ZR-${actionId.slice(-8).toUpperCase()}`;

/** What the report dialog is about */
export type ReportTargetSpec = {
  kind: SafetyTargetKind;
  id: string;
  facet?: SafetyProfileFacet;
  /** Message the target was seen in */
  messageId?: string;
  /** Server shared with a private bot */
  serverId?: string;
  /** Shown at the top of the dialog */
  label?: string;
  /** Image shown next to the label */
  image?: string;
  /** A profile effect: the dialog offers the urgent flashing reason */
  effect?: boolean;
};

export type SafetyReasonOption = WithoutNull__<APITypes__.SafetyReasonOption>;

export type SafetyReceipt = WithoutNull__<APITypes__.SafetyReceipt>;

export type SafetyTarget = WithoutNull__<APITypes__.SafetyTarget>;

export type SafetyCase = WithoutNull__<APITypes__.SafetyCase>;

export type SafetyEvidence = WithoutNull__<APITypes__.SafetyEvidence>;

export type SafetyLogEntry = WithoutNull__<APITypes__.SafetyLogEntry>;

export type SafetyAction = WithoutNull__<APITypes__.SafetyAction>;

export type SafetyAppeal = WithoutNull__<APITypes__.SafetyAppeal>;

export type SafetyCaseDetails = WithoutNull__<APITypes__.SafetyCaseDetails>;

/** Carries the statement of reasons (DSA Art. 17); older entries get defaults */
export type SafetyStandingEntry = WithoutNull__<APITypes__.SafetyStandingEntry>;

/** What the reviewer says about a decision; shown to the person */
export type SafetyStatementInput = {
  ground:
    | { type: "Law"; law: string; provision: string }
    /** `rule:<Category>` is shown by its translated name */
    | { type: "Terms"; rule: string };
  facts: string;
  territorial_scope?: string;
  automated_detection?: boolean;
  automated_decision?: boolean;
};

/** Report filed without an account (Art. 16); shown to reviewers only */
export type SafetyPublicReporter =
  WithoutNull__<APITypes__.SafetyPublicReporter>;

/** Law the content breaks, or the Zrzur rule it breaks */
export type SafetyGround = WithoutNull__<APITypes__.SafetyGround>;

export type SafetyStanding = WithoutNull__<APITypes__.SafetyStanding>;

export type SafetyAccess = WithoutNull__<APITypes__.SafetyAccess>;

export type SafetyQueueFilter = {
  status?: string;
  kind?: string;
  category?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  before?: string;
  oldest?: boolean;
  limit?: number;
};

const id = (value: string) => encodeURIComponent(value);

/** Reports, appeals and actions are never sent twice, not even after a 429 */
const NO_RETRY = { retries: 0 };

export const safetyApi = {
  reasons: (client: Client, kind: SafetyTargetKind) =>
    client.api.get(`/safety/reasons/${kind}`).then(withoutNull),

  report: (
    client: Client,
    target: ReportTargetSpec,
    body: {
      category: SafetyCategory;
      subcategory?: string;
      description?: string;
      evidence_message_ids?: string[];
    },
  ) =>
    client.api
      .post(
        "/safety/reports",
        {
          target: {
            kind: target.kind,
            id: target.id,
            facet: target.facet,
            message_id: target.messageId,
            server_id: target.serverId,
          },
          ...body,
        },
        NO_RETRY,
      )
      .then(withoutNull),

  myReports: (client: Client) =>
    client.api.get("/safety/reports").then(withoutNull),

  reply: (client: Client, reportId: string, text: string) =>
    client.api
      .post(`/safety/reports/${id(reportId)}/info`, { text }, NO_RETRY)
      .then(withoutNull),

  standing: (client: Client) =>
    client.api.get("/safety/standing").then(withoutNull),

  appeal: (client: Client, actionId: string, statement: string) =>
    client.api
      .post(`/safety/standing/${id(actionId)}/appeal`, { statement }, NO_RETRY)
      .then(withoutNull),

  access: (client: Client) =>
    client.api.get("/safety/admin/access").then(withoutNull),

  queue: (client: Client, filter: SafetyQueueFilter) =>
    client.api.get("/safety/admin/reports", filter).then(withoutNull),

  details: (client: Client, caseId: string) =>
    client.api.get(`/safety/admin/reports/${id(caseId)}`).then(withoutNull),

  setStatus: (
    client: Client,
    caseId: string,
    body: {
      status: SafetyStatus;
      public_note?: string;
      note?: string;
      version: number;
    },
  ) =>
    client.api
      .post(`/safety/admin/reports/${id(caseId)}/status`, body)
      .then(withoutNull),

  edit: (
    client: Client,
    caseId: string,
    body: {
      assignee_id?: string;
      priority?: SafetyPriority;
      duplicate_of?: string;
      legal_hold?: boolean;
      version: number;
    },
  ) =>
    client.api
      .patch(`/safety/admin/reports/${id(caseId)}`, body)
      .then(withoutNull),

  note: (client: Client, caseId: string, text: string) =>
    client.api
      .post(`/safety/admin/reports/${id(caseId)}/notes`, { text })
      .then(withoutNull),

  act: (
    client: Client,
    caseId: string,
    body: {
      kind: SafetyActionKind;
      public_reason: string;
      internal_note?: string;
      duration_days?: number;
      version: number;
      /** Statement of reasons (DSA Art. 17) */
      statement: SafetyStatementInput;
    },
  ) =>
    client.api
      .post(`/safety/admin/reports/${id(caseId)}/actions`, body, NO_RETRY)
      .then(withoutNull),

  revoke: (client: Client, actionId: string, reason: string) =>
    client.api
      .post(
        `/safety/admin/actions/${id(actionId)}/revoke`,
        { reason },
        NO_RETRY,
      )
      .then(withoutNull),

  bulk: (
    client: Client,
    body: {
      ids: string[];
      status?: SafetyStatus;
      priority?: SafetyPriority;
      assign_self?: boolean;
      note?: string;
    },
  ) => client.api.post("/safety/admin/reports/bulk", body).then(withoutNull),

  appeals: (client: Client, status: SafetyAppealStatus | "all" = "Pending") =>
    client.api.get("/safety/admin/appeals", { status }).then(withoutNull),

  decideAppeal: (
    client: Client,
    appealId: string,
    body: { overturn: boolean; note: string },
  ) =>
    client.api
      .post(`/safety/admin/appeals/${id(appealId)}`, body, NO_RETRY)
      .then(withoutNull),
};

/** Error type of a failed request (`NotFound`, `TooManyReports`, ...) */
export function safetyErrorType(error: unknown): string | undefined {
  try {
    const body = typeof error === "string" ? JSON.parse(error) : error;
    return (body as { type?: string })?.type;
  } catch {
    return undefined;
  }
}

/** Actions that make sense for a target kind */
export function actionsFor(kind: SafetyTargetKind): SafetyActionKind[] {
  const account: SafetyActionKind[] = [
    "Warning",
    "SuspendAccount",
    "BanAccount",
  ];
  switch (kind) {
    case "Message":
    case "Attachment":
    case "Webhook":
      return ["Warning", "RemoveMessage", "SuspendAccount", "BanAccount"];
    case "User":
      return account;
    case "Server":
    case "DiscoverServer":
      return [
        "Warning",
        "RemoveDiscoverListing",
        "SuspendAccount",
        "BanAccount",
      ];
    case "Bot":
    case "Application":
    case "DiscoverBot":
      return ["Warning", "DisableBot", "RemoveDiscoverListing"];
    case "CommunityItem":
      return ["Warning", "SuspendCommunityItem"];
    default:
      return account;
  }
}

/** Reviewer state changes offered for a status (the server re-checks) */
export function nextStatuses(status: SafetyStatus): SafetyStatus[] {
  switch (status) {
    case "Submitted":
    case "Queued":
      return ["UnderReview", "Escalated", "NoViolation"];
    case "UnderReview":
      return ["MoreInfoRequired", "Escalated", "NoViolation", "Queued"];
    case "MoreInfoRequired":
      return ["UnderReview", "Escalated", "NoViolation", "Closed"];
    case "Escalated":
      return ["UnderReview", "NoViolation"];
    case "ActionTaken":
    case "NoViolation":
    case "Duplicate":
    case "AppealResolved":
      return ["Closed"];
    default:
      return [];
  }
}
