import { useLingui } from "@lingui/solid/macro";

import { AnyBadgeId } from "./catalog";

export type BadgeText = {
  name: string;
  description: string;
  /** How to earn it (empty for retired badges) */
  earn: string;
};

/** Translated name, description and how-to-earn of every badge */
export function useBadgeText(): (id: string) => BadgeText {
  const { t } = useLingui();
  return (id: string) => {
    const years = t`Shown automatically for each full year of your account, counted in UTC; your profile shows the highest year. Hidden while you hide "Member since" on your profile.`;
    const texts: Record<AnyBadgeId, BadgeText> = {
      founder: {
        name: t`Zrzur Founder`,
        description: t`Founded Zrzur.`,
        earn: "",
      },
      staff: {
        name: t`Zrzur Staff`,
        description: t`A member of the official Zrzur team. Server moderators don't get this badge.`,
        earn: t`Only for the Zrzur team; it is never requested or bought.`,
      },
      developer: {
        name: t`Zrzur Developer`,
        description: t`Builds Zrzur itself.`,
        earn: t`Given to Zrzur's own developers.`,
      },
      platform_moderator: {
        name: t`Platform Moderator`,
        description: t`Keeps Zrzur safe for everyone.`,
        earn: t`Given to Zrzur's platform moderation team.`,
      },
      partner: {
        name: t`Zrzur Partner`,
        description: t`An approved Zrzur partner or partner community.`,
        earn: t`Apply as a partner; the Zrzur team reviews every application against the partner criteria.`,
      },
      super_creator: {
        name: t`Super Creator`,
        description: t`An outstanding Zrzur Designs creator, chosen by the team.`,
        earn: t`Hold Creator, with at least 25 approved, original, published designs and 180 days in the creator program. 25 is only a minimum: the team chooses. Duplicates, simple recolours and copied assets don't count.`,
      },
      creator: {
        name: t`Creator`,
        description: t`Designs and publishes profile designs in Zrzur Designs.`,
        earn: t`Given after you join the Designs creator program and publish your first original, approved design. It stays for good unless the work was fraudulent or infringing. Making bots or videos doesn't count.`,
      },
      elite_bug_hunter: {
        name: t`Elite Bug Hunter`,
        description: t`Exceptional bug and security contributions, recognised by the team.`,
        earn: t`Hold Bug Hunter, then have 10 verified reports or a verified serious security report. The team decides; it is never automatic.`,
      },
      bug_hunter: {
        name: t`Bug Hunter`,
        description: t`Found a real bug that the Zrzur team verified.`,
        earn: t`Report a bug in Feedback. You get it when a reviewer confirms your report, not for sending it.`,
      },
      beta_tester: {
        name: t`Beta Tester`,
        description: t`Tries Zrzur features before everyone else.`,
        earn: t`Join the closed beta program by invitation or request. It is shown while you are in the program.`,
      },
      beta_veteran: {
        name: t`Beta Veteran`,
        description: t`Completed a Zrzur beta cycle with real contributions.`,
        earn: t`Complete a beta cycle with at least 3 reviewed feedback reports or 1 confirmed bug report; the team approves it after the cycle. It stays, but gives no beta access.`,
      },
      plus: {
        name: t`Zrzur Feather`,
        description: t`Supports Zrzur with an active Feather subscription.`,
        earn: t`Shown while your Feather subscription is active. You can hide it.`,
      },
      early_supporter: {
        name: t`Early Supporter`,
        description: t`Supported Zrzur in its early days.`,
        earn: t`Given to people who supported Zrzur during the early supporter period.`,
      },
      early_adopter: {
        name: t`Early Adopter`,
        description: t`Joined Zrzur in its first days.`,
        earn: t`Shown for accounts created before 1 March 2027, 00:00 UTC. Hidden while you hide "Member since" on your profile.`,
      },
      one_year: {
        name: t`One Year on Zrzur`,
        description: t`Has been on Zrzur for a year.`,
        earn: years,
      },
      years_2: {
        name: t`Two Years on Zrzur`,
        description: t`Has been on Zrzur for two years.`,
        earn: years,
      },
      three_years: {
        name: t`Three Years on Zrzur`,
        description: t`Has been on Zrzur for three years.`,
        earn: years,
      },
      years_4: {
        name: t`Four Years on Zrzur`,
        description: t`Has been on Zrzur for four years.`,
        earn: years,
      },
      years_5: {
        name: t`Five Years on Zrzur`,
        description: t`Has been on Zrzur for five years.`,
        earn: years,
      },
      years_6: {
        name: t`Six Years on Zrzur`,
        description: t`Has been on Zrzur for six years.`,
        earn: years,
      },
      years_7: {
        name: t`Seven Years on Zrzur`,
        description: t`Has been on Zrzur for seven years.`,
        earn: years,
      },
      years_8: {
        name: t`Eight Years on Zrzur`,
        description: t`Has been on Zrzur for eight years.`,
        earn: years,
      },
      years_9: {
        name: t`Nine Years on Zrzur`,
        description: t`Has been on Zrzur for nine years.`,
        earn: years,
      },
      years_10: {
        name: t`Ten Years on Zrzur`,
        description: t`Has been on Zrzur for ten years.`,
        earn: years,
      },
      community_builder: {
        name: t`Community Builder`,
        description: t`Owns a server that reached 100 genuine human members.`,
        earn: t`Own a server that reaches 100 genuine human members. Bots, deleted, banned or suspended accounts, accounts under 7 days old or without a confirmed e-mail, and people who joined less than a day ago don't count. Counted a few times a day; it stays if the server gets smaller.`,
      },
      big_community: {
        name: t`Big Community`,
        description: t`Owns a server that reached 1,000 genuine human members.`,
        earn: t`Own a server that reaches 1,000 genuine human members, counted as for Community Builder. It stays if the server gets smaller. It is not a partnership or a verification.`,
      },
      verified_server_owner: {
        name: t`Verified Server Owner`,
        description: t`Owns a server the Zrzur team verified.`,
        earn: t`Own a verified server. It is shown while you do.`,
      },
      verified_bot_developer: {
        name: t`Verified Bot Developer`,
        description: t`Made a bot the Zrzur team verified.`,
        earn: t`Own a verified bot. It is shown while you do.`,
      },
      community_helper: {
        name: t`Community Helper`,
        description: t`Helped people with support.`,
        earn: t`Given by the Zrzur team to people who help others with support.`,
      },
      translator: {
        name: t`Translator`,
        description: t`Helped translate Zrzur.`,
        earn: "",
      },
      responsible_disclosure: {
        name: t`Responsible Disclosure`,
        description: t`Reported a security issue responsibly.`,
        earn: "",
      },
      supporter: {
        name: t`Supporter`,
        description: t`Supported Zrzur.`,
        earn: "",
      },
      reserved_1: {
        name: t`Special badge`,
        description: t`A one-off badge.`,
        earn: "",
      },
      reserved_2: {
        name: t`Special badge`,
        description: t`A one-off badge.`,
        earn: "",
      },
      server_owner: {
        name: t`Server owner`,
        description: t`Owns this server.`,
        earn: "",
      },
      server_official: {
        name: t`Official Zrzur server`,
        description: t`Run by the Zrzur team.`,
        earn: "",
      },
      server_verified: {
        name: t`Verified server`,
        description: t`The Zrzur team confirmed who runs this server.`,
        earn: "",
      },
      bot_verified: {
        name: t`Verified bot`,
        description: t`The Zrzur team reviewed this bot.`,
        earn: "",
      },
    };
    return texts[id as AnyBadgeId] ?? { name: id, description: "", earn: "" };
  };
}
