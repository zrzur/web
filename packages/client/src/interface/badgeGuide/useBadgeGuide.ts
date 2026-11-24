import { createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import type { AnyBadgeId } from "@revolt/ui/components/features/profiles/badges/catalog";

/** How a badge is earned */
export type GuideHow = "automatic" | "application" | "team" | "none";

export type GuideEntry = {
  id: AnyBadgeId;
  how: GuideHow;
  /** A name of its own on this page (the time badges as one entry) */
  name?: string;
  /** The published criteria, one sentence each */
  criteria: string[];
};

export type GuideSection = {
  id: string;
  title: string;
  entries: GuideEntry[];
};

/** The day the published criteria last changed (shown on the page) */
export const CRITERIA_CHANGED = Date.UTC(2026, 10, 24);

/**
 * The public badge guide: every badge given out today, what it takes and
 * how it is earned. The text follows the owner-approved public guide
 * (badge audit 2026-11-23, section B) and the rules the server applies;
 * it never promises a review date (Zrzur is run by volunteers). Retired
 * badges are not listed.
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
    const staysIfSmaller = t`Permanent once legitimately earned, even if the server gets smaller.`;

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
            how: "none",
            criteria: [
              t`The one person who started Zrzur. No application, activity or command can give it.`,
              t`Permanent; it cannot be transferred.`,
            ],
          },
          {
            id: "staff",
            how: "team",
            criteria: [
              t`An officially appointed member of the Zrzur team, with a recorded appointment.`,
              serverStaffNot,
              appointmentEnds,
            ],
          },
          {
            id: "developer",
            how: "team",
            criteria: [
              t`A meaningful, verified technical contribution to Zrzur itself, or an approved official development role.`,
              t`Building your own bot does not qualify.`,
              t`Kept as recognition unless obtained by fraud.`,
            ],
          },
          {
            id: "platform_moderator",
            how: "team",
            criteria: [
              t`Formally appointed to platform-level moderation, after accepting the moderation rules and the team's conduct requirements.`,
              serverStaffNot,
              appointmentEnds,
            ],
          },
        ],
      },
      {
        id: "programs",
        title: t`Programs you apply for`,
        entries: [
          {
            id: "partner",
            how: "application",
            criteria: [
              t`At least 5,000 genuine human members and a server at least 180 days old.`,
              t`Over the last 8 weeks, on average at least 500 weekly active members and 200 weekly contributors, and at least 20% of new members still there after their first week.`,
              t`A clear purpose, published rules, active moderation and protection against spam and raids; no bought members or fake engagement.`,
              t`The numbers only let you apply; two people on the team approve. Checked again every 180 days.`,
              t`Partnership is not verification. It ends if the server changes hands.`,
            ],
          },
          {
            id: "verified_server_owner",
            how: "application",
            criteria: [
              t`Your server is the authentic official home of a real game, developer, company, creator, organisation, brand or established project: authenticity, not popularity.`,
              t`At least 10,000 genuine human members and 180 days. A clearly official entity may qualify below these numbers with a senior approval and a second person.`,
              t`Control of the official domain, proven with a DNS TXT record or a file on the website. Claiming to be famous is not proof.`,
              t`Never automatic. The badge stays while you own the verified server and ends if the server changes hands.`,
            ],
          },
          {
            id: "verified_bot_developer",
            how: "application",
            criteria: [
              t`Your bot is in at least 25 legitimate servers and has run for at least 30 days. Servers of one owner count at most twice, and your own servers never count.`,
              t`A clear and accurate description, at least one working feature, a privacy policy if it handles user data, and permissions that fit what it does.`,
              t`No malicious commands, token theft, deception or inflated installs. 25 servers only unlock the application; a review decides.`,
              t`After approval the bot shows a check in its Bot label. It ends if the bot changes hands, is suspended or is deleted.`,
            ],
          },
          {
            id: "content_creator",
            how: "application",
            criteria: [
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
            how: "automatic",
            criteria: [
              t`Accepted into the Zrzur Designs creator program, with a first original, approved, published design.`,
              t`Not for video creators, streamers or bot developers.`,
              t`Permanent unless the work was fraudulent or infringing.`,
            ],
          },
          {
            id: "super_creator",
            how: "team",
            criteria: [
              t`Hold Creator, with at least 25 approved, original, published designs and 180 days in the creator program.`,
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
            how: "automatic",
            criteria: [
              t`You own a server that reached 100 genuine human members.`,
              t`Bots, deleted, banned or suspended accounts, new accounts and manipulated joins do not count.`,
              staysIfSmaller,
            ],
          },
          {
            id: "big_community",
            how: "automatic",
            criteria: [
              t`The same as Community Builder, at 1,000 genuine human members.`,
              t`It is not a partnership or a verification.`,
              staysIfSmaller,
            ],
          },
          {
            id: "community_helper",
            how: "team",
            criteria: [
              t`Given by the team to people who help others with constructive support; spam, copied or misleading answers earn nothing.`,
              keptUnlessFraud,
            ],
          },
          {
            id: "bug_hunter",
            how: "team",
            criteria: [
              t`One original, reproducible bug report with enough detail, confirmed by a reviewer.`,
              t`Duplicates, invalid or made-up reports do not count; report security issues privately.`,
              t`Permanent.`,
            ],
          },
          {
            id: "elite_bug_hunter",
            how: "team",
            criteria: [
              t`Already a Bug Hunter, with at least 10 confirmed reports or one verified serious security vulnerability; the reviewer sets the severity.`,
              t`Two people on the team approve. Permanent.`,
            ],
          },
          {
            id: "beta_tester",
            how: "automatic",
            criteria: [
              t`Accepted into the closed beta and following its rules and confidentiality.`,
              t`Shown only while you take part.`,
            ],
          },
          {
            id: "beta_veteran",
            how: "team",
            criteria: [
              t`Completed a beta cycle with at least 3 reviewed feedback reports or 1 confirmed bug report; the team approves it after the cycle.`,
              t`Permanent; it gives no access to future betas.`,
            ],
          },
        ],
      },
      {
        id: "time",
        title: t`Time and support`,
        entries: [
          {
            id: "early_adopter",
            how: "automatic",
            criteria: [
              t`Your account was created before 1 March 2027, 00:00 UTC.`,
              ageHidden,
            ],
          },
          {
            id: "one_year",
            how: "automatic",
            name: t`Years on Zrzur`,
            criteria: [
              t`Your account has existed for full calendar years, counted in UTC from its creation; your profile shows the highest year, up to ten.`,
              ageHidden,
            ],
          },
          {
            id: "plus",
            how: "automatic",
            criteria: [
              t`Shown while you have an active Feather subscription; you can hide it.`,
              t`It ends when the subscription ends or after a full refund.`,
            ],
          },
          {
            id: "early_supporter",
            how: "team",
            criteria: [
              t`Supported Zrzur during its early-support period.`,
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
            how: "team",
            criteria: [
              t`A server run by the Zrzur team itself. Set only by Zrzur, never by application.`,
              t`When a server is both official and verified, Official is shown.`,
            ],
          },
          {
            id: "server_verified",
            how: "application",
            criteria: [
              t`Shown on a server that passed the Verified Server review (see Verified Server Owner above).`,
            ],
          },
          {
            id: "server_owner",
            how: "automatic",
            criteria: [
              t`Shown next to the person who owns the server now; it follows ownership.`,
            ],
          },
          {
            id: "bot_verified",
            how: "application",
            criteria: [
              t`A check in the Bot label of a bot that passed the Verified Bot review.`,
            ],
          },
        ],
      },
    ];

    return { rules, sections };
  });
}
