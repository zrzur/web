import { useLingui } from "@lingui/solid/macro";

import { AnyBadgeId } from "./catalog";

/** How a badge is given */
export type BadgeHow = "automatic" | "application" | "team" | "none";

export type BadgeText = {
  name: string;
  /** What it means, one short line (tooltips, profile, My Badges, /badges) */
  description: string;
  /**
   * How it is earned, one line: the "Badges you can earn" tile in My Badges
   * and the first line under the badge on /badges. Empty for retired badges.
   * It never tells people to apply: the apply button is shown only while
   * the server takes applications.
   */
  earn: string;
  how: BadgeHow;
};

/**
 * The one source of every badge's name, meaning and how it is earned
 * (owner, 2026-11-24). The text follows the owner-approved public guide
 * (badge audit 2026-11-23, section B) and the rules the server applies. It
 * never promises a review time: Zrzur is run by volunteers. The guide at
 * /badges adds only further details below the `earn` line
 * (`src/interface/badgeGuide/useBadgeGuide.ts`).
 */
export function useBadgeText(): (id: string) => BadgeText {
  const { t } = useLingui();
  return (id: string) => {
    const years = t`Your account has existed for full calendar years, counted in UTC from its creation; your profile shows the highest year, up to ten.`;
    const year = (name: string, description: string): BadgeText => ({
      name,
      description,
      earn: years,
      how: "automatic",
    });
    const retired = (name: string, description: string): BadgeText => ({
      name,
      description,
      earn: "",
      how: "none",
    });
    const texts: Record<AnyBadgeId, BadgeText> = {
      founder: {
        name: t`Zrzur Founder`,
        description: t`Founded Zrzur.`,
        earn: t`The one person who started Zrzur. No application, activity or command can give it.`,
        how: "none",
      },
      staff: {
        name: t`Zrzur Staff`,
        description: t`A member of the official Zrzur team. Server moderators don't get this badge.`,
        earn: t`An officially appointed member of the Zrzur team, with a recorded appointment.`,
        how: "team",
      },
      developer: {
        name: t`Zrzur Developer`,
        description: t`Builds Zrzur itself.`,
        earn: t`A meaningful, verified technical contribution to Zrzur itself, or an approved official development role.`,
        how: "team",
      },
      platform_moderator: {
        name: t`Platform Moderator`,
        description: t`Keeps Zrzur safe for everyone.`,
        earn: t`Formally appointed to platform-level moderation, after accepting the moderation rules and the team's conduct requirements.`,
        how: "team",
      },
      partner: {
        name: t`Zrzur Partner`,
        description: t`An established community with long-term activity, quality and responsible moderation.`,
        earn: t`By application, reviewed by the Zrzur team: at least 5,000 genuine human members, a server at least 180 days old and steady weekly activity.`,
        how: "application",
      },
      super_creator: {
        name: t`Super Creator`,
        description: t`An outstanding Zrzur Designs creator, chosen by the team.`,
        earn: t`Hold Creator, with at least 25 approved, original, published designs and 180 days in the creator program.`,
        how: "team",
      },
      creator: {
        name: t`Creator`,
        description: t`Designs and publishes profile designs in Zrzur Designs.`,
        earn: t`Accepted into the Zrzur Designs creator program, with a first original, approved, published design.`,
        how: "automatic",
      },
      content_creator: {
        name: t`Content Creator`,
        description: t`Awarded to established creators of original, high-quality content who meet Zrzur's verification and quality standards.`,
        earn: t`By application, reviewed by the Zrzur team: at least 100,000 real followers on one platform, 90 days of activity and regular original work.`,
        how: "application",
      },
      elite_bug_hunter: {
        name: t`Elite Bug Hunter`,
        description: t`Exceptional bug and security contributions, recognised by the team.`,
        earn: t`Already a Bug Hunter, with at least 10 confirmed reports or one verified serious security vulnerability; the reviewer sets the severity.`,
        how: "team",
      },
      bug_hunter: {
        name: t`Bug Hunter`,
        description: t`Found a real bug that the Zrzur team verified.`,
        earn: t`One original, reproducible bug report with enough detail, confirmed by a reviewer.`,
        how: "team",
      },
      beta_tester: {
        name: t`Beta Tester`,
        description: t`Tries Zrzur features before everyone else.`,
        earn: t`Accepted into the closed beta and following its rules and confidentiality.`,
        how: "automatic",
      },
      beta_veteran: {
        name: t`Beta Veteran`,
        description: t`Completed a Zrzur beta cycle with real contributions.`,
        earn: t`Completed a beta cycle with at least 3 reviewed feedback reports or 1 confirmed bug report; the team approves it after the cycle.`,
        how: "team",
      },
      plus: {
        name: t`Zrzur Feather`,
        description: t`Supports Zrzur with an active Feather subscription.`,
        earn: t`Shown while you have an active Feather subscription; you can hide it.`,
        how: "automatic",
      },
      early_supporter: {
        name: t`Early Supporter`,
        description: t`Supported Zrzur in its early days.`,
        earn: t`Supported Zrzur during its early-support period.`,
        how: "team",
      },
      early_adopter: {
        name: t`Early Adopter`,
        description: t`Joined Zrzur in its first days.`,
        earn: t`Your account was created before 1 March 2027, 00:00 UTC.`,
        how: "automatic",
      },
      one_year: year(t`One Year on Zrzur`, t`Has been on Zrzur for a year.`),
      years_2: year(t`Two Years on Zrzur`, t`Has been on Zrzur for two years.`),
      three_years: year(
        t`Three Years on Zrzur`,
        t`Has been on Zrzur for three years.`,
      ),
      years_4: year(
        t`Four Years on Zrzur`,
        t`Has been on Zrzur for four years.`,
      ),
      years_5: year(
        t`Five Years on Zrzur`,
        t`Has been on Zrzur for five years.`,
      ),
      years_6: year(t`Six Years on Zrzur`, t`Has been on Zrzur for six years.`),
      years_7: year(
        t`Seven Years on Zrzur`,
        t`Has been on Zrzur for seven years.`,
      ),
      years_8: year(
        t`Eight Years on Zrzur`,
        t`Has been on Zrzur for eight years.`,
      ),
      years_9: year(
        t`Nine Years on Zrzur`,
        t`Has been on Zrzur for nine years.`,
      ),
      years_10: year(
        t`Ten Years on Zrzur`,
        t`Has been on Zrzur for ten years.`,
      ),
      community_builder: {
        name: t`Community Builder`,
        description: t`Owns a server that reached 100 genuine human members.`,
        earn: t`Automatic when a server you own reaches 100 genuine human members; it stays if the server gets smaller.`,
        how: "automatic",
      },
      big_community: {
        name: t`Big Community`,
        description: t`Owns a server that reached 1,000 genuine human members.`,
        earn: t`Automatic when a server you own reaches 1,000 genuine human members, counted as for Community Builder; it stays if the server gets smaller.`,
        how: "automatic",
      },
      // cancelled (owner, 2026-11-24): named only for people who have it
      verified_server_owner: retired(
        t`Verified Server Owner`,
        t`Owns a server the Zrzur team verified.`,
      ),
      verified_bot_developer: {
        name: t`Verified Bot Developer`,
        description: t`Owns or develops a bot that passed Zrzur's verification review.`,
        earn: t`By application, reviewed by the Zrzur team: open to every bot, whatever its size; the team looks at its servers, its age and what it does.`,
        how: "application",
      },
      community_helper: {
        name: t`Community Helper`,
        description: t`Helped people with support.`,
        earn: t`Given by the team to people who help others with constructive support; spam, copied or misleading answers earn nothing.`,
        how: "team",
      },
      translator: retired(t`Translator`, t`Helped translate Zrzur.`),
      responsible_disclosure: retired(
        t`Responsible Disclosure`,
        t`Reported a security issue responsibly.`,
      ),
      supporter: retired(t`Supporter`, t`Supported Zrzur.`),
      reserved_1: retired(t`Special badge`, t`A one-off badge.`),
      reserved_2: retired(t`Special badge`, t`A one-off badge.`),
      server_owner: {
        name: t`Server owner`,
        description: t`Owns this server.`,
        earn: t`Shown next to the person who owns the server now; it follows ownership.`,
        how: "automatic",
      },
      server_official: {
        name: t`Official Zrzur server`,
        description: t`Run by the Zrzur team.`,
        earn: t`A server run by the Zrzur team itself. Set only by Zrzur, never by application.`,
        how: "team",
      },
      server_verified: {
        name: t`Verified server`,
        description: t`The Zrzur team confirmed who runs this server.`,
        earn: t`By application, reviewed by the Zrzur team: at least 10,000 genuine human members, 180 days, and proven ownership of the official website (DNS or website check).`,
        how: "application",
      },
      bot_verified: {
        name: t`Verified bot`,
        description: t`The Zrzur team reviewed this bot.`,
        earn: t`By application, reviewed by the Zrzur team: a check in the Bot label of a bot that passed the Verified Bot review.`,
        how: "application",
      },
    };
    return (
      texts[id as AnyBadgeId] ?? {
        name: id,
        description: "",
        earn: "",
        how: "none",
      }
    );
  };
}
