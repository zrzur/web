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
        description: t`An outstanding designer of Zrzur profile designs and decorations, chosen by the team.`,
        earn: t`Publish designs as a Creator; the Zrzur team picks Super Creators by hand.`,
      },
      creator: {
        name: t`Creator`,
        description: t`Makes profile designs and decorations for Zrzur's community gallery.`,
        earn: t`Become a Zrzur creator and publish your first decoration, nameplate or effect. Making bots doesn't count.`,
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
        description: t`Completed a Zrzur beta program.`,
        earn: t`Complete the beta as an active tester who sent feedback or a bug report. It stays, but gives no beta access.`,
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
        earn: t`Accounts created before the early adopter cut-off.`,
      },
      one_year: {
        name: t`One Year on Zrzur`,
        description: t`Has been on Zrzur for a year.`,
        earn: t`Given automatically when your account turns one year old.`,
      },
      three_years: {
        name: t`Three Years on Zrzur`,
        description: t`Has been on Zrzur for three years.`,
        earn: t`Given automatically when your account turns three years old.`,
      },
      community_builder: {
        name: t`Community Builder`,
        description: t`Built a server that reached 100 members.`,
        earn: t`Own a server that reaches 100 members. It stays if the server gets smaller.`,
      },
      big_community: {
        name: t`Big Community`,
        description: t`Built a server that reached 1,000 members.`,
        earn: t`Own a server that reaches 1,000 members. It stays if the server gets smaller.`,
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
      saha_champion: {
        name: t`Saha Champion`,
        description: t`Won a tournament or came first in the games bot.`,
        earn: t`Win a tournament, or come first in the games bot.`,
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
