import { useLingui } from "@lingui/solid/macro";

import type { ApplicationStatus, ProgramCheck, ProgramId } from "./programsApi";

/** Lines only Content Creator has */
const CREATOR_LINES: Record<string, true> = {
  channel: true,
  followers: true,
  active_days: true,
  works: true,
  quality: true,
};

/**
 * Words for the badge programs: names, checklist lines, statuses, the
 * reasons a reviewer gives and the codes the server answers with. The
 * server sends codes; every one is written out here in the reader's
 * language.
 */
export function useProgramText() {
  const { t } = useLingui();

  const program = (id: ProgramId) =>
    ({
      partner: t`Zrzur Partner`,
      verified_server: t`Verified Server`,
      verified_bot: t`Verified Bot Developer`,
      content_creator: t`Content Creator`,
    })[id] ?? id;

  /** Content Creator: a platform, in plain text */
  const platform = (id: string, name?: string) =>
    id === "other" && name
      ? name
      : ((
          {
            youtube: "YouTube",
            tiktok: "TikTok",
            twitch: "Twitch",
            instagram: "Instagram",
            x: "X",
            kick: "Kick",
            facebook: "Facebook",
            other: t`Another platform`,
          } as Record<string, string>
        )[id] ?? id);

  /** Content Creator: a kind of content */
  const category = (id: string) =>
    (
      ({
        education: t`Education`,
        technology: t`Technology and programming`,
        gaming: t`Gaming`,
        livestream: t`Livestreaming`,
        tutorials: t`Tutorials`,
        creative: t`Creative production`,
        comedy: t`Comedy and entertainment`,
        art: t`Art`,
        film: t`Film`,
        commentary: t`Commentary`,
        other: t`Something else`,
      }) as Record<string, string>
    )[id] ?? id;

  const status = (value: ApplicationStatus) =>
    ({
      Draft: t`Draft`,
      Submitted: t`Sent`,
      InReview: t`In review`,
      MoreInfo: t`More information needed`,
      Approved: t`Approved`,
      Refused: t`Not approved`,
      Withdrawn: t`Withdrawn`,
      Ended: t`Ended`,
    })[value] ?? value;

  /** One line of the checklist, with the numbers when there are some */
  const check = (line: ProgramCheck, program?: ProgramId): string => {
    const value = line.value ?? 0;
    const needed = line.needed ?? 0;
    if (program === "content_creator" || line.code in CREATOR_LINES)
      return creatorCheck(line, value, needed);
    switch (line.code) {
      case "owner":
        return t`You are its owner`;
      case "members":
        return t`Genuine human members: ${value} of ${needed}`;
      case "age":
        return t`Days since the server was made: ${value} of ${needed}`;
      case "no_burst":
        return t`No sudden burst of joins or new accounts`;
      case "activity_weeks":
        return t`Weeks of activity measured: ${value} of ${needed}`;
      case "weekly_active":
        return t`Weekly active members on average: ${value} of ${needed}`;
      case "weekly_contributors":
        return t`Weekly contributors on average: ${value} of ${needed}`;
      case "retention":
        return line.met === undefined
          ? t`New members still here after their first week: not enough joins yet, a person checks it`
          : t`New members still here after their first week: ${value}% of ${needed}%`;
      case "ownership":
        return t`Control of the official website or domain is proven`;
      case "bot_active":
        return t`The bot is not suspended`;
      case "bot_age":
        return t`Days since the bot was made: ${value} of ${needed}`;
      case "legit_servers":
        return t`Servers that count: ${value} of ${needed}`;
      case "email":
        return t`Your e-mail address is confirmed`;
      case "adult":
        return t`You are 18 or older`;
      case "target":
        return t`The server or bot exists`;
      default:
        return line.code;
    }
  };

  /** Content Creator's lines: a person on the team checks the channel */
  const creatorCheck = (
    line: ProgramCheck,
    value: number,
    needed: number,
  ): string => {
    const count = (n: number) => n.toLocaleString();
    switch (line.code) {
      case "channel":
        return t`Your channel, its kind of content and ${needed || 5} recent works or a livestream schedule are filled in`;
      case "ownership":
        return line.met
          ? t`A reviewer found your code on the channel`
          : t`Your code is in the channel's description or a pinned post`;
      case "followers":
        return line.met === undefined
          ? t`At least ${count(needed)} real followers on that one platform`
          : t`Followers the reviewer saw: ${count(value)} of ${count(needed)}`;
      case "active_days":
        return line.met === undefined
          ? t`At least ${needed} days of active publishing`
          : t`Days active: ${value} of ${needed}`;
      case "works":
        return line.met === undefined
          ? t`At least ${needed} substantial original works in the last 90 days, or a regular livestream schedule`
          : t`Original works in the last 90 days: ${value} of ${needed}`;
      case "quality":
        return line.met === undefined
          ? t`The team's quality review: originality, effort, consistency, authenticity, safety, honesty, rights`
          : t`Quality criteria met: ${value} of ${needed}`;
      default:
        return check({ ...line, code: line.code }, undefined);
    }
  };

  /** A reason a reviewer gave, as a sentence */
  const reason = (code: string) =>
    ({
      criteria_met: t`The published criteria are met.`,
      more_information: t`Some information is missing to decide.`,
      purpose_unclear: t`The server's purpose is not clear from what the team saw.`,
      rules_missing: t`The server has no published rules, or they are too thin.`,
      moderation: t`The team did not see active, accountable moderation.`,
      security_measures: t`Anti-spam, anti-raid or account-security measures are missing.`,
      safety_violations: t`There are unresolved serious safety violations.`,
      fake_engagement: t`The team found signs of bought members or fake activity.`,
      metrics_not_met: t`The numbers on the badge page are not met any more.`,
      other: t`Another reason, written below.`,
      ownership_not_proven: t`Control of the named website, domain or account was not proven.`,
      not_official: t`The team could not confirm that the server officially represents the entity.`,
      branding: t`The name or branding is not the entity's own.`,
      description_inaccurate: t`The bot's description is not clear or not accurate.`,
      no_working_feature: t`The team could not use a working feature of the bot.`,
      privacy_policy: t`The bot processes user data but its privacy policy is missing or unclear.`,
      permissions: t`The bot asks for permissions it does not need for what it does.`,
      malicious: t`The bot has harmful commands, collects data it may not, or deceives people.`,
      inflated_installs: t`The bot's servers were inflated with servers that do not count.`,
      followers_not_met: t`The follower number the team saw on that one platform is below the published minimum.`,
      activity_not_met: t`The channel has not been active for long enough.`,
      works_not_met: t`The team did not find enough substantial original works in the last 90 days, or an equivalent regular livestream schedule.`,
      originality: t`Originality: most of the work is reposted or copied without an original contribution.`,
      effort: t`Effort: the works show little real effort, for example repetitive content made to collect views.`,
      consistency: t`Consistency: the channel rests on one viral upload rather than regular work.`,
      authenticity: t`Authenticity: the review found signs of bought followers or coordinated fake engagement.`,
      safety: t`Safety and legality: the content breaks the law or Zrzur's rules.`,
      honesty: t`Honesty: systematic misleading clickbait, impersonation or false claims.`,
      rights: t`Rights: repeated infringement, stolen content or unauthorised reuploads.`,
    })[code] ?? code;

  /** Why an approved program ended */
  const ended = (code?: string) =>
    ({
      ownership_transferred: t`The server or bot has a new owner.`,
      server_deleted: t`The server was deleted.`,
      bot_deleted: t`The bot was deleted.`,
      bot_suspended: t`The bot was suspended.`,
      mark_removed: t`The team took the mark away.`,
      recheck: t`A new check found the conditions are no longer met.`,
      badge_removed: t`The team took the badge away.`,
    })[code ?? ""] ?? "";

  /** What a refused action of the applicant means, or undefined to fall
   * back to the general error text */
  const failure = (code?: string) => {
    if (!code) return undefined;
    if (code.startsWith("not_eligible:"))
      return t`Not every line of the checklist is met yet.`;
    return (
      {
        open_application: t`There is already an open application for this.`,
        already_approved: t`This already has the badge or mark.`,
        reapply_wait: t`After a refusal, a new application has to wait.`,
        too_many_open: t`You have three open applications. Finish or withdraw one first.`,
        not_authorized: t`Confirm that you may represent it before you send.`,
        challenge_not_found: t`The code was not found yet. DNS changes can take a while; try again later.`,
        challenge_expired: t`This code has expired. Ask for a new one.`,
        domain: t`Enter a domain name such as example.com, without https:// or a path.`,
        https_link: t`Links must start with https:// and point to a public website.`,
        too_many_links: t`Add at most five links.`,
        not_editable: t`This application can't be changed now.`,
        appeal_window_closed: t`The 30 days to appeal have passed.`,
        already_appealed: t`You already appealed this decision.`,
        changed_meanwhile: t`Something changed meanwhile. Reload and try again.`,
        platform: t`Choose the platform of your channel.`,
        platform_name: t`Write the name of the platform (at most 40 characters).`,
        category: t`Choose the kind of content you make.`,
        too_many_works: t`Add at most ten links to works.`,
        schedule: t`Describe your livestream schedule in at most 500 characters.`,
        channel_needed: t`Add the address of your channel first.`,
        checked_by_reviewer: t`A person on the team looks for the code on your channel after you send the application.`,
      } as Record<string, string>
    )[code];
  };

  return {
    program,
    status,
    check,
    reason,
    ended,
    failure,
    platform,
    category,
  };
}
