import { useLingui } from "@lingui/solid/macro";

import type {
  SafetyActionKind,
  SafetyAppealStatus,
  SafetyCategory,
  SafetyPriority,
  SafetyReceiptStatus,
  SafetyStandingLevel,
  SafetyStatus,
  SafetyTargetKind,
} from "./safetyApi";

/**
 * Translated names for Trust & Safety values. Reasons get a one-line hint
 * so people can pick without being asked for graphic detail.
 */
export function useSafetyLabels() {
  const { t } = useLingui();

  const category: Record<SafetyCategory, { name: string; hint: string }> = {
    Harassment: {
      name: t`Harassment or bullying`,
      hint: t`Insults, targeting someone, unwanted contact or raids`,
    },
    HateOrThreats: {
      name: t`Hate or threats`,
      hint: t`Attacks on a group, or threats of violence`,
    },
    Spam: {
      name: t`Spam`,
      hint: t`Unwanted ads, mass mentions or fake engagement`,
    },
    ScamFraud: {
      name: t`Scam or fraud`,
      hint: t`Phishing, fake giveaways or money scams`,
    },
    Impersonation: {
      name: t`Impersonation`,
      hint: t`Pretending to be you, someone else or Zrzur`,
    },
    MaliciousLinks: {
      name: t`Malicious links`,
      hint: t`Links that lead to phishing or harmful sites`,
    },
    Malware: {
      name: t`Malware`,
      hint: t`Files or links that try to harm devices`,
    },
    PrivacyViolation: {
      name: t`Privacy violation`,
      hint: t`Collecting or misusing people's data`,
    },
    PersonalInformation: {
      name: t`Sharing personal information`,
      hint: t`Someone's address, documents or private images without consent`,
    },
    SexualContent: {
      name: t`Sexual or exploitative content`,
      hint: t`Unwanted sexual content, or anything involving a minor`,
    },
    SelfHarm: {
      name: t`Self-harm or suicide`,
      hint: t`Someone may be at risk`,
    },
    IllegalContent: {
      name: t`Illegal content`,
      hint: t`Illegal goods, extortion, hacking or extreme violence`,
    },
    BotAbuse: {
      name: t`Bot abuse`,
      hint: t`A bot sends spam, abuses commands or asks for too much`,
    },
    MisleadingApplication: {
      name: t`Misleading application`,
      hint: t`An app that misrepresents what it does or where its links go`,
    },
    UnauthorisedContent: {
      name: t`Unauthorised content`,
      hint: t`Content shared without the owner's permission`,
    },
    IntellectualProperty: {
      name: t`Copyright or trademark`,
      hint: t`Your work or brand used without permission`,
    },
    Underage: {
      name: t`Under minimum age`,
      hint: t`The user appears to be too young for Zrzur`,
    },
    Other: {
      name: t`Something else`,
      hint: t`Tell us what's wrong in your own words`,
    },
  };

  const subcategory: Record<string, string> = {
    flashing: t`Flashing or harmful: it could cause seizures`,
    targeted: t`Targeted at me or someone else`,
    bullying: t`Bullying`,
    unwanted_contact: t`Unwanted contact`,
    raid: t`Raid`,
    hate_speech: t`Hate speech`,
    violent_threat: t`Threat of violence`,
    violent_extremism: t`Violent extremism`,
    unsolicited_ads: t`Unsolicited ads`,
    mass_mentions: t`Mass mentions`,
    fake_engagement: t`Fake engagement`,
    phishing: t`Phishing`,
    fake_giveaway: t`Fake giveaway`,
    financial_scam: t`Money scam`,
    account_trading: t`Selling or trading accounts`,
    impersonates_me: t`Pretends to be me`,
    impersonates_someone: t`Pretends to be someone else`,
    impersonates_zrzur: t`Pretends to be Zrzur staff`,
    impersonates_zarzour: t`Pretends to be Zrzur staff`,
    doxxing: t`Address or documents`,
    address_or_phone: t`Home address or phone number`,
    private_images: t`Private images`,
    unsolicited: t`Unwanted sexual content`,
    non_consensual: t`Shared without consent`,
    minor_safety: t`Involves a minor`,
    self_harm: t`Self-harm`,
    suicide: t`Suicide`,
    drugs_goods: t`Drugs or illegal goods`,
    extortion: t`Extortion or blackmail`,
    hacking: t`Hacking`,
    violent_gore: t`Extreme violence or gore`,
    spam_dms: t`Sends spam DMs`,
    command_abuse: t`Abuses commands`,
    excessive_permissions: t`Asks for too many permissions`,
    fake_features: t`Fake features`,
    deceptive_oauth: t`Misleading sign-in or permissions`,
    fraudulent_links: t`Fraudulent links`,
    copyright: t`Copyright`,
    trademark: t`Trademark`,
  };

  const kind: Record<SafetyTargetKind, string> = {
    User: t`User`,
    Message: t`Message`,
    Server: t`Server`,
    Channel: t`Channel`,
    Bot: t`Bot`,
    Application: t`Application`,
    CommunityItem: t`Community design`,
    Attachment: t`Attachment`,
    Invite: t`Invite`,
    Webhook: t`Webhook`,
    DiscoverServer: t`Discover server listing`,
    DiscoverBot: t`Discover bot listing`,
  };

  const status: Record<SafetyStatus, string> = {
    Submitted: t`Submitted`,
    Queued: t`Queued`,
    UnderReview: t`Under review`,
    MoreInfoRequired: t`More information required`,
    Escalated: t`Escalated`,
    ActionTaken: t`Action taken`,
    NoViolation: t`No violation found`,
    Duplicate: t`Duplicate`,
    Closed: t`Closed`,
    Appealed: t`Appealed`,
    AppealResolved: t`Appeal resolved`,
  };

  const receipt: Record<SafetyReceiptStatus, string> = {
    Submitted: t`Received`,
    InReview: t`In review`,
    NeedsInfo: t`We need more information`,
    ActionTaken: t`Action taken`,
    NoViolation: t`No violation found`,
    Closed: t`Closed`,
  };

  const priority: Record<SafetyPriority, string> = {
    Low: t`Low`,
    Normal: t`Normal`,
    High: t`High`,
    Urgent: t`Urgent`,
  };

  const action: Record<SafetyActionKind | "SuspendCreator", string> = {
    Warning: t`Warning`,
    RemoveMessage: t`Message removed`,
    SuspendAccount: t`Account suspended`,
    BanAccount: t`Account banned`,
    DisableBot: t`Bot disabled`,
    RemoveDiscoverListing: t`Removed from Discover`,
    SuspendCommunityItem: t`Design suspended`,
    SuspendCreator: t`Creator access paused`,
  };

  const appeal: Record<SafetyAppealStatus, string> = {
    Pending: t`Appeal pending`,
    Upheld: t`Appeal declined`,
    Overturned: t`Appeal accepted`,
  };

  const standing: Record<
    SafetyStandingLevel,
    { name: string; description: string }
  > = {
    Good: {
      name: t`All good`,
      description: t`Thanks for following the Zrzur guidelines.`,
    },
    Limited: {
      name: t`Limited`,
      description: t`You have a recent violation. Keep to the guidelines and it will expire.`,
    },
    VeryLimited: {
      name: t`Very limited`,
      description: t`You have several recent violations.`,
    },
    AtRisk: {
      name: t`At risk`,
      description: t`Further violations may lead to a suspension.`,
    },
    Suspended: {
      name: t`Suspended`,
      description: t`Your account is suspended.`,
    },
  };

  return {
    category,
    subcategory,
    kind,
    status,
    receipt,
    priority,
    action,
    appeal,
    standing,
  };
}
