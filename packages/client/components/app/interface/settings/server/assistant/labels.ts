import { useLingui } from "@lingui/solid/macro";

/** Every word of the Assistant's pages, in one place */
export function useAssistantWords() {
  const { t } = useLingui();

  const modules: Record<string, { name: string; line: string }> = {
    moderation: {
      name: t`Moderation & Cases`,
      line: t`Warn, time out, kick and ban with numbered cases and appeals.`,
    },
    automod: {
      name: t`AutoMod Rules`,
      line: t`Arabic presets and a ladder of steps on Zrzur's own filters.`,
    },
    shield: {
      name: t`Shield`,
      line: t`Stops raids and mass deletions, and locks the server in one step.`,
    },
    verify: {
      name: t`Verification`,
      line: t`A button or a short sum gives new members their role.`,
    },
    logs: {
      name: t`Logs`,
      line: t`What happens in the server, in one staff channel.`,
    },
    welcome: {
      name: t`Welcome & Goodbye`,
      line: t`A card with the Hijri date when someone joins or leaves.`,
    },
    roles: {
      name: t`Roles`,
      line: t`Automatic roles and panels members pick from.`,
    },
    inbox: {
      name: t`Support Inbox`,
      line: t`Tickets and direct messages in one queue.`,
    },
    embeds: {
      name: t`Messages & Embeds`,
      line: t`Write, schedule and edit messages for the bot to post.`,
    },
  };

  const groups: Record<string, string> = {
    safety: t`Safety`,
    community: t`Community`,
    support: t`Support`,
    utilities: t`Utilities`,
  };

  const fields: Record<string, string> = {
    "moderation.dmOnAction": t`Tell members by direct message`,
    "moderation.appeals": t`Allow ban appeals`,
    "moderation.appealsChannel": t`Channel for appeals`,
    "moderation.requireReason": t`Ask moderators for a reason`,
    "automod.presets": t`Presets`,
    "automod.exemptRoles": t`Roles the rules skip`,
    "automod.exemptChannels": t`Channels the rules skip`,
    "automod.ladderWarn": t`Warn at this many strikes (0 is off)`,
    "automod.ladderTimeout": t`Time out at this many strikes (0 is off)`,
    "automod.ladderTimeoutMinutes": t`Timeout length in minutes`,
    "automod.ladderKick": t`Kick at this many strikes (0 is off)`,
    "automod.ladderDays": t`Strikes count for this many days`,
    "shield.joinLimit": t`Joins that count as a raid`,
    "shield.joinWindow": t`Within this many seconds`,
    "shield.autoPause": t`Pause invites during a raid`,
    "shield.pauseHours": t`Pause for this many hours`,
    "shield.antiNuke": t`Stop mass deletions`,
    "shield.nukeLimit": t`Deletions that count as an attack`,
    "shield.nukeWindow": t`Deletions within this many seconds`,
    "shield.trustedRoles": t`Roles Shield trusts`,
    "shield.quarantineRole": t`Quarantine role`,
    "verify.mode": t`How members verify`,
    "verify.role": t`Role given after verifying`,
    "verify.minAccountDays": t`Youngest account allowed, in days`,
    "logs.memberEvents": t`Members joining, leaving and changing roles`,
    "logs.messageEvents": t`Edited and deleted messages`,
    "logs.serverEvents": t`Channel and role changes`,
    "logs.storeContent": t`Keep the text of messages`,
    "logs.retentionDays": t`Keep message text for this many days (90 at most)`,
    "welcome.welcomeChannel": t`Welcome channel`,
    "welcome.goodbyeChannel": t`Goodbye channel`,
    "welcome.card": t`Show as a card`,
    "welcome.showHijri": t`Show the Hijri date`,
    "roles.autoRoles": t`Roles given on joining`,
    "inbox.mode": t`Where tickets open`,
    "inbox.inboxChannel": t`Staff queue channel`,
    "inbox.supportRoles": t`Support roles`,
    "inbox.categories": t`Ticket categories, one per line`,
    "inbox.dmEnabled": t`Direct messages to the bot open a ticket`,
    "inbox.autoCloseHours": t`Close quiet tickets after this many hours (0 is off)`,
    "inbox.hoursEnabled": t`Use support hours`,
    "inbox.hoursStart": t`Support starts at hour`,
    "inbox.hoursEnd": t`Support ends at hour`,
    "inbox.rating": t`Ask members to rate the help`,
    "inbox.transcripts": t`Keep encrypted transcripts`,
  };

  const options: Record<string, string> = {
    "verify.mode.button": t`A button`,
    "verify.mode.captcha": t`A short sum`,
    "inbox.mode.channel": t`A private channel`,
    "inbox.mode.thread": t`A staff thread and direct messages`,
    "automod.presets.insults": t`Insults`,
    "automod.presets.scams": t`Scams`,
    "automod.presets.links": t`Links from new members`,
    "automod.presets.mentions": t`Mass mentions`,
    "automod.presets.repeats": t`Repeated messages`,
  };

  const messages: Record<string, string> = {
    "mod.dm.warn": t`Direct message for a warning`,
    "mod.dm.timeout": t`Direct message for a timeout`,
    "mod.dm.kick": t`Direct message for a kick`,
    "mod.dm.ban": t`Direct message for a ban`,
    "mod.dm.tempban": t`Direct message for a temporary ban`,
    "verify.panel": t`Text of the verification panel`,
    "welcome.message": t`Welcome text`,
    "goodbye.message": t`Goodbye text`,
    "inbox.closedDm": t`Direct message when a ticket closes`,
    "inbox.offHours": t`Text outside support hours`,
  };

  const tabs = {
    settings: t`Settings`,
    messages: t`Messages`,
    permissions: t`Permissions`,
    log: t`Log channel`,
    data: t`Data and retention`,
  };

  const presets: Record<string, string> = {
    friends: t`Friends server`,
    community: t`Public community`,
    support: t`Support or store`,
    gaming: t`Gaming`,
    islamic: t`Islamic or educational`,
  };

  const cases: Record<string, string> = {
    warn: t`Warning`,
    timeout: t`Timeout`,
    untimeout: t`Timeout ended`,
    kick: t`Kick`,
    ban: t`Ban`,
    tempban: t`Temporary ban`,
    unban: t`Unban`,
    note: t`Note`,
    purge: t`Purge`,
    quarantine: t`Quarantine`,
  };

  const tiers = {
    admin: t`Admin`,
    manager: t`Manager`,
    moderator: t`Moderator`,
    support: t`Support`,
  };

  return { modules, groups, fields, options, messages, tabs, presets, cases, tiers };
}
