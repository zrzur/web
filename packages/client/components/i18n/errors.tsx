import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { API } from "@zrzur/sdk/solid";
import { createMemo, Match, Show, Switch } from "solid-js";

const RE_BREAK = /\s*\n\s*/g;

function cleanError(
  error: unknown,
): { type?: never } | { message?: never } | string | undefined {
  // Attempt to parse the incoming error as JSON if it is a string,
  // as some errors (e.g on login) are sent to this function as a string,
  // which then causes the error message to be unlocalised and unhelpful.
  if (typeof error === "string") {
    try {
      return JSON.parse(error);
    } catch {
      // Ignore JSON parse errors
      return error;
    }
  }

  return error as { type?: never } | { message?: never } | undefined;
}

/** Errors whose message names a number the server sends as `max` */
const LIMIT_TYPES = new Set([
  "TooManyAttachments",
  "TooManyReplies",
  "TooManyCommunityItems",
  "TooManyCommands",
  "TooManySupercharges",
  "TooManyRoles",
]);

/** One entry of `fields` in a `FailedValidation` answer */
type ValidationProblem = {
  field: string;
  rule: string;
  min?: number;
  max?: number;
};

/** What the library behind `FailedValidation` prints; older servers sent it */
const RAW_VALIDATOR_TEXT =
  /Validation error:|\[\s*\{\s*"(code|message|params)"/;

const TRANSLATED = Symbol("zrzur.translatedError");

/**
 * An error whose message is already in the reader's language (built with
 * `t`). Only these are shown as written; the text of any other Error is
 * technical and goes under "Details".
 */
export function translatedError(message: string): Error {
  const error = new Error(message);
  (error as unknown as Record<symbol, boolean>)[TRANSLATED] = true;
  return error;
}

function isTranslatedMessage(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error as unknown as Record<symbol, boolean>)[TRANSLATED] === true
  );
}

/** fetch() rejects with a TypeError when the server can't be reached */
function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // a TypeError, or the exact texts browsers give for an unreachable server;
  // other Errors that merely mention "fetch" are not network failures
  return (
    error instanceof TypeError ||
    /^(failed to fetch|load failed|networkerror when attempting to fetch resource\.?)$/i.test(
      error.message.trim(),
    )
  );
}

/**
 * Translate any error
 */
export function useError() {
  const { t, i18n } = useLingui();

  /** The name people know a field by; other fields go without one */
  const fieldName = (field: string): string | undefined => {
    switch (field.split(/[.[]/)[0]) {
      case "statement":
      case "description":
        return t`Description`;
      case "name":
      case "display_name":
        return t`Name`;
      case "website":
        return t`Website`;
      case "support":
        return t`Support link`;
      case "privacy_policy_url":
        return t`Privacy policy link`;
      case "terms_of_service_url":
        return t`Terms of service link`;
      case "reason":
      case "public_reason":
        return t`Reason`;
      case "subject":
        return t`Subject`;
      case "body":
      case "content":
      case "text":
        return t`Message`;
      case "email":
        return t`Email`;
      case "password":
        return t`Password`;
      default:
        return undefined;
    }
  };

  /** What a field needs, in the reader's language */
  const fieldRule = ({ rule, min, max }: ValidationProblem) => {
    const bounded = rule === "length" || rule === "range";
    switch (bounded && min === max && min !== undefined ? "exact" : rule) {
      case "exact":
        return rule === "length"
          ? t`Exactly ${min} characters.`
          : t`Exactly ${min}.`;
      case "length":
        if (min !== undefined && max !== undefined)
          return t`Between ${min} and ${max} characters.`;
        if (min !== undefined) return t`At least ${min} characters.`;
        if (max !== undefined) return t`At most ${max} characters.`;
        return undefined;
      case "range":
        if (min !== undefined && max !== undefined)
          return t`Between ${min} and ${max}.`;
        if (min !== undefined) return t`At least ${min}.`;
        if (max !== undefined) return t`At most ${max}.`;
        return undefined;
      case "count":
        return max !== undefined ? t`At most ${max} items.` : undefined;
      case "https":
        return t`Use a link that starts with https://`;
      case "required":
        return t`This can't be empty.`;
      case "format":
        return t`This doesn't have the right format.`;
      case "taken":
        return t`This is already in use.`;
      case "per_day":
        return max !== undefined
          ? t`You've reached today's limit of ${max}. Try again tomorrow.`
          : undefined;
      case "image":
        return t`This image can't be used. Check its size, frames and length.`;
      case "adult":
        return t`Only people who declared they are 18 or over can be creators.`;
      case "blocked":
        return t`This uses a name that isn't allowed: Zrzur's own, a staff title or another brand.`;
      default:
        return undefined;
    }
  };

  /** The first field problem of a `FailedValidation`, in plain words */
  const validationMessage = (problems: unknown): string | undefined => {
    const first = Array.isArray(problems)
      ? (problems[0] as ValidationProblem | undefined)
      : undefined;
    if (!first || typeof first.field !== "string") return undefined;
    const rule = fieldRule(first);
    if (!rule) return undefined;
    const name = fieldName(first.field);
    return name ? `${name}: ${rule}` : rule;
  };

  return (error: unknown, context?: string) => {
    error = cleanError(error);

    // rate limited: the API answers 429 with { retry_after } in milliseconds.
    // The SDK's ApiError calls an untyped body type "Unknown" and also has
    // `retryAfter`; a 429 with a real type (InSlowmode…) has its own words.
    const rate = error as
      | { retry_after?: unknown; retryAfter?: unknown; type?: unknown }
      | undefined;
    const retryAfter = rate?.retry_after ?? rate?.retryAfter;
    if (
      typeof retryAfter === "number" &&
      (typeof rate?.type !== "string" || rate.type === "Unknown")
    ) {
      const seconds = Math.max(1, Math.ceil(retryAfter / 1000));
      return t`That was a lot at once. ${plural(seconds, {
        one: "Try again in # second.",
        other: "Try again in # seconds.",
      })}`;
    }

    // handle Revolt API errors
    if (
      (error as { type?: never } | undefined)?.type &&
      typeof (error as { type: never }).type === "string"
    ) {
      const err = error as API.Error;

      // Zrzur errors are not in the generated API types yet
      if ((err.type as string) === "TooManyBotCreations") {
        const { max, resets_at } = err as unknown as {
          max?: number;
          resets_at?: number;
        };
        const limit = max ?? 7;
        if (typeof resets_at === "number") {
          const date = new Date(resets_at).toLocaleDateString(i18n().locale, {
            dateStyle: "long",
          });
          return t`You've reached the limit of ${limit} new bots a week. You can make another on ${date}.`;
        }
        return t`You've reached the limit of ${limit} new bots a week. Each one counts for 7 days, then you can make another.`;
      }
      if ((err.type as string) === "MissingPlatformPermission") {
        return t`Only verified creators and Zrzur staff can do this.`;
      }
      if ((err.type as string) === "ProfileTextFiltered") {
        const category = (err as { category?: string }).category;
        const reason =
          category === "Harassment"
            ? t`It looks like harassment.`
            : category === "HateOrThreats"
              ? t`It looks like hate or a threat.`
              : category === "SexualContent"
                ? t`It looks like sexual content.`
                : category === "Spam"
                  ? t`It looks like spam.`
                  : t`It breaks the rules.`;
        return t`Our automatic filter stopped this. ${reason} If you think this is a mistake, ask for a review through Support.`;
      }
      if ((err.type as string) === "CommunityItemConflict") {
        return t`Someone else changed this design first. Reload and try again.`;
      }
      if ((err.type as string) === "AgeRequirementNotMet") {
        return t`Sorry, Zrzur is only for people aged 16 and older.`;
      }
      if ((err.type as string) === "AgeNotDeclared") {
        return t`Add your month and year of birth to continue.`;
      }
      if ((err.type as string) === "AgeChangeNotAllowed") {
        return t`Your age can't be changed this way. If it is wrong, write to privacy@zrzur.com.`;
      }
      if ((err.type as string) === "VanityUnavailable") {
        return t`This server needs a higher Wings level for a custom link.`;
      }
      if ((err.type as string) === "VanityTaken") {
        return t`Another server already uses this link name.`;
      }
      if ((err.type as string) === "VanityReserved") {
        return t`Use 3–32 letters, numbers or single hyphens. Some names are reserved.`;
      }
      if ((err.type as string) === "VanityPaused") {
        return t`This invite link is paused right now.`;
      }
      if ((err.type as string) === "AgeRestricted") {
        return t`This content is only for adults.`;
      }
      if ((err.type as string) === "PollEnded") {
        return t`This poll has ended. Its results are final.`;
      }
      if ((err.type as string) === "ForwardMatureContent") {
        return t`Messages from a mature channel can only be forwarded to another mature channel.`;
      }
      if ((err.type as string) === "DirectMessagesRestricted") {
        return t`This person's privacy settings don't let you message them. Try sending a friend request.`;
      }
      if ((err.type as string) === "GroupInvitesRestricted") {
        return t`This person's privacy settings don't let you add them to group chats.`;
      }
      // the server's verification level (newer than the API types)
      if ((err.type as string) === "VerificationRequired") {
        const { requirement, wait_seconds } = err as unknown as {
          requirement?: string;
          wait_seconds?: number;
        };
        const minutes = Math.max(1, Math.ceil((wait_seconds ?? 60) / 60));
        if (requirement === "email")
          return t`This server asks you to verify your email address before you talk here.`;
        if (requirement === "account_age")
          return t`This server asks for accounts older than 5 minutes. You can talk here in ${minutes} min.`;
        return t`New members can talk here 10 minutes after joining. You can talk in ${minutes} min.`;
      }
      if ((err.type as string) === "AutoModBlocked") {
        const { rule } = err as unknown as { rule?: string };
        return t`This server's AutoMod blocked your message: ${rule ?? ""}`;
      }
      if ((err.type as string) === "RulesNotAccepted") {
        return t`Accept the server rules before you write here.`;
      }
      if ((err.type as string) === "InvitesPaused") {
        return t`This server paused new members for now. Try again later.`;
      }
      if ((err.type as string) === "DirectMessagesPaused") {
        return t`A server you share paused direct messages between members for now.`;
      }
      if ((err.type as string) === "OfficialAccount") {
        return t`You can't do this with an official account. To reply, open a ticket.`;
      }
      if ((err.type as string) === "MasqueradeNameTaken") {
        return t`That name belongs to someone in this server.`;
      }

      const fields = err as unknown as { max?: number; retry_after?: number };
      const max = fields.max ?? 0;
      const plain: Record<string, () => string> = {
        LabelMe: () => t`Something went wrong. Try again in a moment.`,
        UnknownUser: () => t`This person doesn't exist any more.`,
        NotFriends: () => t`You need to be friends with this person first.`,
        UnknownChannel: () => t`This channel doesn't exist any more.`,
        UnknownAttachment: () =>
          t`A file didn't finish uploading. Add it again and try once more.`,
        UnknownMessage: () => t`This message doesn't exist any more.`,
        CannotDeleteMessage: () => t`You can't delete this message.`,
        TooManyAttachments: () =>
          t`You can add up to ${max} files to one message.`,
        TooManyEmbeds: () => t`This message has too many embeds.`,
        TooManyReplies: () =>
          t`You can reply to up to ${max} messages at once.`,
        NotInGroup: () => t`You're not in this group any more.`,
        NotPinned: () => t`This message isn't pinned.`,
        InSlowmode: () =>
          t`Slow mode is on here. ${plural(
            Math.max(1, fields.retry_after ?? 1),
            {
              one: "You can write again in # second.",
              other: "You can write again in # seconds.",
            },
          )}`,
        CantCreateServers: () => t`Your account can't create servers.`,
        UnknownServer: () => t`This server doesn't exist any more.`,
        InvalidRole: () => t`This role doesn't exist any more.`,
        TooManyCommunityItems: () =>
          t`You can share up to ${max} designs. Remove one and try again.`,
        TooManyReports: () =>
          t`You've sent many reports today. Try again tomorrow.`,
        SafetyCaseConflict: () =>
          t`Someone else changed this case first. Reload and try again.`,
        UnknownApplication: () => t`This app doesn't exist any more.`,
        ApplicationNotInstalled: () => t`This app isn't added to the server.`,
        ApplicationOffline: () =>
          t`This app isn't answering right now. Try again later.`,
        SignedDeliveryRejected: () =>
          t`That address didn't pass the test. Check it and try again.`,
        UnknownCommand: () => t`This command doesn't exist any more.`,
        CommandAlreadyExists: () => t`A command with this name already exists.`,
        TooManyCommands: () => t`An app can have up to ${max} commands.`,
        UnknownInteraction: () => t`This action doesn't exist any more.`,
        InteractionExpired: () => t`This action has expired. Try it again.`,
        InteractionAlreadyAcknowledged: () =>
          t`This action has already been answered.`,
        TooManyFollowups: () => t`This action has too many replies.`,
        TooManySupercharges: () =>
          t`You've used all your Wings. You can give up to ${max}.`,
        PromotionSlotsFull: () =>
          t`All Discover places are taken right now. Try again later.`,
        NotOnDiscover: () => t`This server has to be on Discover first.`,
        TooManyRoles: () => t`A server can have up to ${max} roles.`,
        IsBot: () => t`Bots can't do this.`,
        IsNotBot: () => t`Only bots can do this.`,
        MissingIntent: () => t`This bot isn't allowed to do this.`,
        BotNeedsVerification: () =>
          t`This bot needs to be verified before it can join more servers.`,
        NotPrivileged: () => t`Only Zrzur staff can do this.`,
        NotOwner: () => t`Only the owner can do this.`,
        IsElevated: () => t`You can't do this to someone with a higher role.`,
        InvalidOperation: () =>
          t`This can't be done right now. Check what you entered and try again.`,
        InvalidProperty: () =>
          t`Something you entered isn't valid. Check it and try again.`,
        InvalidFlagValue: () =>
          t`Something you entered isn't valid. Check it and try again.`,
        NotAuthenticated: () => t`Please log in again.`,
        HeaderTooLarge: () => t`This request is too large. Try again.`,
        OperationFailed: () => t`That didn't work. Try again in a moment.`,
        IncorrectData: () =>
          t`Something you entered isn't valid. Check it and try again.`,
        LiveKitUnavailable: () =>
          t`Voice isn't available right now. Try again later.`,
        NotAVoiceChannel: () => t`This isn't a voice channel.`,
        AlreadyConnected: () => t`You're already in this call.`,
        NotConnected: () => t`You're not in this call.`,
        UnknownNode: () => t`Voice isn't available right now. Try again later.`,
        ProxyError: () => t`This link couldn't be loaded.`,
        FileTooSmall: () => t`This file is empty.`,
        FileTooLarge: () => t`This file is too large.`,
        NoEmbedData: () => t`This link has no preview.`,
        VosoUnavailable: () =>
          t`Voice isn't available right now. Try again later.`,
        RenderFail: () => t`This page couldn't be shown. Try again.`,
        MissingHeaders: () => t`Something went wrong. Try again in a moment.`,
        BlockedByShield: () => t`This sign up is marked as spam.`,
        EmailFailed: () =>
          t`The email couldn't be sent. Try again in a few minutes.`,
        InvalidToken: () =>
          t`This link has expired or was already used. Ask for a new one.`,
        MissingInvite: () => t`You need an invite to sign up.`,
        InvalidInvite: () => t`This invite has expired or doesn't exist.`,
        Blacklisted: () => t`This email address can't be used.`,
        DisallowedMFAMethod: () =>
          t`This way of confirming isn't allowed here. Choose another one.`,
      };
      const known = plain[err.type as string];
      if (known) {
        // the server didn't send the limit: never print "up to 0"
        if (!max && LIMIT_TYPES.has(err.type as string))
          return t`You've reached the limit for this. Remove one and try again.`;
        return known();
      }

      switch (err.type) {
        case "AlreadyFriends":
          return t`Already friends with this user.`;
        case "AlreadyInGroup":
          return t`You're already part of this group.`;
        case "AlreadyInServer":
          return t`You're already part of this server.`;
        case "AlreadyOnboarded":
          return t`Your user has already been created? Try logging in again or refreshing the app.`;
        case "AlreadyPinned":
          return t`This message is already pinned.`;
        case "AlreadySentRequest":
          return t`You've already sent a request to this user.`;
        case "Banned":
          if (context === "discover")
            return t`You may not submit this item to discover.`;
          return t`You are banned from this server.`;
        case "Blocked":
          return t`You have this user blocked.`;
        case "BlockedByOther":
          return t`This user has blocked you.`;
        case "BotIsPrivate":
          return t`This bot is private and can only be added by the creator.`;
        case "CaptchaFailed":
          return t`The security check didn't work. Please try again.`;
        case "CannotEditMessage":
          return t`Cannot edit this message.`;
        case "CannotGiveMissingPermissions":
          return t`You cannot give yourself missing permissions.`;
        case "CannotJoinCall":
          return t`You cannot join this call.`;
        case "CannotRemoveYourself":
          return t`You cannot remove yourself.`;
        case "CannotReportYourself":
          return t`You cannot report yourself.`;
        case "CannotTimeoutYourself":
          return t`You cannot timeout yourself.`;
        case "DatabaseError":
          return t`Something went wrong on our side. Try again in a moment.`;
        case "DiscriminatorChangeRatelimited":
          return t`Your discriminator change has been ratelimited, please try again later.`;
        case "DuplicateNonce":
          return t`This has already been sent.`;
        case "EmptyMessage":
          return t`This message is empty and has not been sent.`;
        case "FailedValidation":
          return (
            validationMessage(
              (err as unknown as { fields?: unknown }).fields,
            ) ?? t`Something you entered isn't valid. Check it and try again.`
          );
        case "FeatureDisabled":
          return t`This feature is currently disabled.`;
        case "FileTypeNotAllowed":
          return t`This file type is not allowed.`;
        case "GroupTooLarge":
          return t`This group is too large, you can have up to ${err.max} users.`;
        case "ImageProcessingFailed":
          return t`Failed to process the image you provided.`;
        case "InternalError":
          return t`Something went wrong on our side. Try again in a moment.`;
        case "InvalidCredentials":
          return t`Provided email or password is wrong.`;
        case "InvalidSession":
          return t`Please log in again.`;
        case "InvalidUsername":
          return t`This username is not allowed.`;
        case "MissingPermission":
          if (err.permission === "CreateThreads")
            return t`You can't start threads in this channel.`;
          if (err.permission === "CreateForumPosts")
            return t`You can't start posts in this forum.`;
          if (err.permission === "SendMessageInThreads")
            return t`You can't write in this thread.`;
          return t`You do not have permission to do this.`;
        case "MissingUserPermission":
          return t`You do not have permission to do this.`;
        case "NoEffect":
          return t`That action had no effect.`;
        case "NotElevated":
          return t`Your role ranking is too low to take this action.`;
        case "NotFound":
          return t`Could not find what you requested.`;
        case "ReachedMaximumBots":
          return t`You've reached your personal bot limit.`;
        case "UsernameTaken":
          return t`This username is already taken.`;
        case "TooManyEmoji":
          return t`You can't have more than ${err.max} emojis on this server.`;
        case "TooManyChannelWebhooks":
          return t`This channel has as many webhooks as it can have (${err.max}). Delete one first.`;
        case "TooManyServerEvents":
          return t`This server already has ${err.max} upcoming events. Cancel or delete one first.`;
        case "TooManyServerWebhooks":
          return t`This server has as many webhooks as it can have (${err.max}). Delete one first.`;
        case "ThreadsDisabled":
          return t`Threads are off in this server. Existing ones can only be read.`;
        case "ForumsDisabled":
          return t`Forums are off in this server. Existing posts can only be read.`;
        case "PluginsDisabled":
          return t`Plugins aren't available on Zrzur right now.`;
        case "ForumThreadRequired":
          return t`Webhooks in a forum post into a thread, so name one when sending.`;
        case "RateLimited":
          return t`Too many messages at once. Wait a moment and try again.`;
        case "TooManyChannels":
          return t`You can't have more than ${err.max} channels on this server.`;
        case "TooManyServers":
          return t`You can't be in more than ${err.max} servers, please leave one and try again.`;
        case "TooManyPendingFriendRequests":
          return t`You've sent too many friend requests, the maximum is ${err.max}`;
        case "PayloadTooLarge":
          return t`Your message is too long, please remove some characters and try again.`;
        case "ShortPassword":
          return t`The password is too short.`;
        case "LockedOut":
          return t`You have been locked out for entering a wrong password multiple times. Please wait a couple minutes and try again.`;
        case "CompromisedPassword":
          return t`This password has previously appeared in security leaks, please use another password.`;
        case "UnverifiedAccount":
          return t`This account is not activated! Please check your account's inbox and try again.`;
        case "TotpAlreadyEnabled":
          return t`Multi-factor authentication is already enabled for this account.`;
        case "ContactSupport":
          switch (err.locale) {
            case "discover.bot_removal_approved":
              return t`The bot is already on discover, the user must contact support to have it removed`;
            case "discover.bot_removal_removed":
              return t`The bot has been removed from discover by moderators, the user must contact support.`;
            case "discover.server_removal_approved":
              return t`The server is already on discover, the user must contact support to have it removed.`;
            case "discover.server_removal_removed":
              return t`The server has been removed from discover by moderators, the user must contact support.`;
            case "discover.declined_apply_again":
              return t`The Discover request was declined. Declined requests cannot be removed, but the user may submit again.`;
            case "discover.cannot_auto_remove":
              return t`The Discover request is approved or the item has been removed from discover. In either case, the user must contact support.`;
            case "discover.removed_cannot_apply":
              return t`The item was removed by moderators, and as such future applications are prohibited. Contact support for more information.`;
            default:
              return t`Your request failed. Please contact support.`;
          }

        default:
          return t`Something went wrong. Try again in a moment.`;
      }
    }

    // a message the caller already translated (see `translatedError`) is
    // shown as written; any other Error's text is technical and English, so
    // it only goes under "Details"
    if (error instanceof Error || isTranslatedMessage(error)) {
      if (isTranslatedMessage(error)) {
        const message = error.message.trim();
        if (message) return message;
      }
      if (isNetworkFailure(error)) {
        return t`Can't reach Zrzur. Check your connection.`;
      }
      return t`Something went wrong. Try again in a moment.`;
    }
    if (
      (error as { message?: never } | undefined)?.message &&
      typeof (error as { message: never }).message === "string"
    ) {
      return t`Something went wrong. Try again in a moment.`;
    } else if (typeof error === "string") {
      // Strip HTML from string. Parse in an inert document: innerHTML on an
      // element of the live page would load <img onerror=...> and run it.
      const p = new DOMParser().parseFromString(error, "text/html");
      p.querySelector("head")?.remove();
      p.querySelector("[role=contentinfo]")?.remove();
      error = (p.body?.textContent ?? "").trim().replace(RE_BREAK, ". ");
    }

    // an object we know nothing about would print as "[object Object]"
    if (error && typeof error === "object") {
      return t`Something went wrong. Try again in a moment.`;
    }

    return t`Something went wrong. Try again in a moment.`;
  };
}

/**
 * The technical part of an error, for the "Details" fold: the error type and
 * a plain line from the server. Not translated. Paths, source locations and
 * text from libraries stay out: they go to the log, not to a person.
 * @param error Anything thrown
 * @returns One or more lines, or undefined if there is nothing to add
 */
export function errorDetails(error: unknown): string | undefined {
  const clean = cleanError(error);
  if (typeof clean === "string") {
    const text = new DOMParser()
      .parseFromString(clean, "text/html")
      .body?.textContent?.trim()
      .replace(RE_BREAK, ". ");
    return text && !RAW_VALIDATOR_TEXT.test(text) ? text : undefined;
  }
  if (!clean || typeof clean !== "object") return undefined;

  const { type, error: line } = clean as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof type === "string" && type !== "Unknown") lines.push(type);
  if (typeof line === "string" && !RAW_VALIDATOR_TEXT.test(line))
    lines.push(line);
  if (clean instanceof Error && clean.message && !lines.length) {
    if (!RAW_VALIDATOR_TEXT.test(clean.message)) lines.push(clean.message);
  }
  return lines.join("\n") || undefined;
}

type TranslatedErrorProps = {
  error: unknown;
  /** Show the technical part under "Details" (default: yes) */
  details?: boolean;
};

export function TranslatedError(props: TranslatedErrorProps) {
  const err = useError();

  const errorString = createMemo(() => {
    const clean = cleanError(props.error);

    if (
      (clean as { type?: never } | undefined)?.type &&
      typeof (clean as { type: never }).type === "string"
    ) {
      const err = clean as API.Error;

      return err;
    }

    return err(props.error);
  });

  const details = () => errorDetails(props.error);

  return (
    <>
      <Switch fallback={errorString() as string}>
        <Match when={typeof errorString() !== "string"}>
          <Switch fallback={err(props.error)}>
            <Match
              when={(errorString() as API.Error).type === "BlockedByShield"}
            >
              <Trans>
                This sign up is marked as spam. Please see{" "}
                <a
                  href="/help/blocked-for-spam"
                  target="_blank"
                  rel="noreferrer"
                >
                  this support article.
                </a>
              </Trans>
            </Match>
          </Switch>
        </Match>
      </Switch>
      <Show when={props.details !== false && details()}>
        <details class="z-error-details">
          <summary>
            <Trans>Details</Trans>
          </summary>
          <code>{details()}</code>
        </details>
      </Show>
    </>
  );
}
