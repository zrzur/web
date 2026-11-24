import { createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import type { AnyBadgeId } from "@revolt/ui/components/features/profiles/badges/catalog";

export type GuideEntry = {
  id: AnyBadgeId;
  /** A name of its own on this page (the time badges as one entry) */
  name?: string;
  /**
   * The published criteria past the badge's shared line, one sentence each.
   * Name, meaning, how it is earned and how it is given come from
   * `useBadgeText`, the one source the app shows everywhere.
   */
  details: string[];
};

export type GuideSection = {
  id: string;
  title: string;
  entries: GuideEntry[];
};

/** The day the published criteria last changed (shown on the page) */
export const CRITERIA_CHANGED = Date.UTC(2026, 10, 24);

/**
 * The public badge guide: every badge given out today, grouped, with the
 * criteria past the shared `earn` line. The text follows the owner-approved
 * public guide (badge audit 2026-11-23, section B) and the rules the server
 * applies; it never promises a review date (Zrzur is run by volunteers).
 * Retired badges are not listed.
 */
export function useBadgeGuide(): () => {
  rules: string[];
  sections: GuideSection[];
} {
  const { t } = useLingui();
  // built when read, so a change of language shows at once
  return createMemo(() => {
    const appointmentEnds = t`Removed when the appointment ends.`;
    const serverStaffNot = t`Server moderators and server staff do not qualify.`;
    const keptUnlessFraud = t`Permanent unless obtained by fraud.`;
    const ageHidden = t`Automatic and permanent. Hidden while you hide "Member since" on your profile.`;

    const rules = [
      t`Zrzur is built by volunteers. Reviews happen when a volunteer is available; we do not promise a review time.`,
      t`Requirements are published here and applied the same way to everyone. Nobody on the team can approve their own application.`,
      t`A badge can be removed if it was obtained by fraud, fake members or engagement, impersonation, stolen work, or a serious rule violation.`,
      t`When an application is refused, you are told why and can appeal once within 30 days from your Badges settings. When a badge is suspended or removed for a rule breach, you get a statement of reasons and can appeal as for any other moderation decision.`,
      t`Bots never count as members, and bot accounts cannot hold profile badges.`,
      t`A badge means only what this page says. It is not an endorsement and not a guarantee of quality or safety.`,
    ];

    const sections: GuideSection[] = [
      {
        id: "team",
        title: t`Zrzur team`,
        entries: [
          {
            id: "founder",
            details: [t`Permanent; it cannot be transferred.`],
          },
          {
            id: "staff",
            details: [appointmentEnds],
          },
          {
            id: "developer",
            details: [
              t`Building your own bot does not qualify.`,
              t`Kept as recognition unless obtained by fraud.`,
            ],
          },
          {
            id: "platform_moderator",
            details: [serverStaffNot, appointmentEnds],
          },
        ],
      },
      {
        id: "programs",
        title: t`Programs by application`,
        entries: [
          {
            id: "partner",
            details: [
              t`Over the last 8 weeks, on average at least 500 weekly active members and 200 weekly contributors, and at least 20% of new members still there after their first week.`,
              t`A clear purpose, published rules, active moderation and protection against spam and raids; no bought members or fake engagement.`,
              t`The numbers only let you apply; two people on the team approve. Checked again every 180 days.`,
              t`Partnership is not verification. It ends if the server changes hands.`,
            ],
          },
          {
            id: "verified_server_owner",
            details: [
              t`Your server is the authentic official home of a real game, developer, company, creator, organisation, brand or established project: authenticity, not popularity.`,
              t`Control of the official domain, proven with a DNS TXT record or a file on the website. Claiming to be famous is not proof.`,
              t`A clearly official entity may qualify below these numbers with a senior approval and a second person.`,
              t`Never automatic. The badge stays while you own the verified server and ends if the server changes hands.`,
            ],
          },
          {
            id: "verified_bot_developer",
            details: [
              t`Servers of one owner count at most twice, and your own servers never count.`,
              t`A clear and accurate description, at least one working feature, a privacy policy if it handles user data, and permissions that fit what it does.`,
              t`No malicious commands, token theft, deception or inflated installs. 25 servers only unlock the application; a review decides.`,
              t`After approval the bot shows a check in its Bot label. It ends if the bot changes hands, is suspended or is deleted.`,
            ],
          },
          {
            id: "content_creator",
            details: [
              t`For creators of educational, technology, gaming and livestream, tutorial, creative, comedy, art, film, commentary and other legitimate content, on any platform.`,
              t`At least 100,000 real followers or subscribers on ONE platform; platforms are not added together.`,
              t`At least 90 days of active publishing, and at least 5 substantial original works in the last 90 days or an equivalent regular livestream schedule.`,
              t`You show the channel is yours by placing a code in its description or a pinned post. A person on the team checks it and the follower number by hand; Zrzur does not connect to the platform.`,
              t`The first approval always includes a quality review against these criteria: originality, meaningful effort, consistency, authenticity, safety and legality, honesty, rights. Two people approve.`,
              t`Not eligible: mass reposts without an original contribution, repetitive low-effort view farming, stolen or impersonated identities, bought followers or coordinated fake engagement, systematically misleading or fraudulent content, serious repeated rule violations. A genre (comedy, gaming, memes) is never a reason to refuse.`,
              t`Appeal within 30 days; apply again after 90 days, or at once if only information was missing.`,
            ],
          },
        ],
      },
      {
        id: "designs",
        title: t`Designs creators`,
        entries: [
          {
            id: "creator",
            details: [
              t`Not for video creators, streamers or bot developers.`,
              t`Permanent unless the work was fraudulent or infringing.`,
            ],
          },
          {
            id: "super_creator",
            details: [
              t`25 is only a minimum: the team chooses. Duplicates, simple recolours and copied assets do not count.`,
              t`Permanent unless obtained by fraud or serious misconduct.`,
            ],
          },
        ],
      },
      {
        id: "achievements",
        title: t`Achievements`,
        entries: [
          {
            id: "community_builder",
            details: [
              t`Bots, deleted, banned or suspended accounts, accounts under 7 days old or without a confirmed e-mail, and people who joined less than a day ago don't count. Counted a few times a day.`,
            ],
          },
          {
            id: "big_community",
            details: [t`It is not a partnership or a verification.`],
          },
          {
            id: "community_helper",
            details: [keptUnlessFraud],
          },
          {
            id: "bug_hunter",
            details: [
              t`Duplicates, invalid or made-up reports do not count; report security issues privately.`,
              t`Permanent.`,
            ],
          },
          {
            id: "elite_bug_hunter",
            details: [t`Two people on the team approve. Permanent.`],
          },
          {
            id: "beta_tester",
            details: [t`Shown only while you take part.`],
          },
          {
            id: "beta_veteran",
            details: [t`Permanent; it gives no access to future betas.`],
          },
        ],
      },
      {
        id: "time",
        title: t`Time and support`,
        entries: [
          {
            id: "early_adopter",
            details: [ageHidden],
          },
          {
            id: "one_year",
            name: t`Years on Zrzur`,
            details: [ageHidden],
          },
          {
            id: "plus",
            details: [
              t`It ends when the subscription ends or after a full refund.`,
            ],
          },
          {
            id: "early_supporter",
            details: [
              t`The period, the kinds of support that count and the evidence needed will be published here once decided.`,
            ],
          },
        ],
      },
      {
        id: "marks",
        title: t`Server and bot marks`,
        entries: [
          {
            id: "server_official",
            details: [
              t`When a server is both official and verified, Official is shown.`,
            ],
          },
          {
            id: "server_verified",
            details: [],
          },
          {
            id: "server_owner",
            details: [],
          },
          {
            id: "bot_verified",
            details: [],
          },
        ],
      },
    ];

    return { rules, sections };
  });
}
