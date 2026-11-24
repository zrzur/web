import { useLingui } from "@lingui/solid/macro";

import type { ApplicationStatus, ProgramCheck, ProgramId } from "./programsApi";

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
    })[id] ?? id;

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
  const check = (line: ProgramCheck) => {
    const value = line.value ?? 0;
    const needed = line.needed ?? 0;
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
      } as Record<string, string>
    )[code];
  };

  return { program, status, check, reason, ended, failure };
}
