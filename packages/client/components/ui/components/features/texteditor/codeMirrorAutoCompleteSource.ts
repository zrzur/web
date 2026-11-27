import { t } from "@lingui/core/macro";
import { userHandle } from "@revolt/common/lib/userTag";
import { Accessor, createMemo } from "solid-js";

import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { User } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import {
  isRegionalIndicator,
  UNICODE_ZWNJ,
  unicodeEmojiUrl,
} from "@revolt/markdown/emoji/UnicodeEmoji";
import { useState } from "@revolt/state";

import { AutoCompleteSearchSpace } from "../../utils/autoComplete";

import { pickByFold } from "@revolt/common/lib/arabicFold";
import { EMOJI_KEYS, getEmojiByShorthand } from "@revolt/ui/emojis";

import { channelGlyph } from "./channelGlyph";
import { isInCodeBlock } from "./codeMirrorCommon";

const MAPPED_EMOJI_KEYS = EMOJI_KEYS.values()
  .toArray()
  .map(
    (id) =>
      ({
        type: "emoji",
        label: `:${id}:`,
        apply: getEmojiByShorthand(id)?.emoji,
      }) as Completion,
  );

// a name may hold vowel marks (\p{M}) and digits of any script (\p{N}):
// «هُدى», «غرفة٢». Without them the list closed at the first mark typed.
const RE_match = /(?<!\p{L}\w)[:@%#][\p{L}\p{M}\p{N}\w\-+]*/u;

/** Most names offered at once when the list is filtered here */
const MAX_FOLDED = 25;

/**
 * CodeMirror compares what was typed with a label letter by letter, so
 * «احمد» never reached «أحمد», nor «كريم» the «کریم» of a Persian keyboard.
 * Text outside ASCII is compared here instead, folded (see foldText): names
 * that start with it first, then the others, each group in name order.
 * ASCII text keeps CodeMirror's own matching and ranking.
 */
function foldedOptions(
  options: (Completion & { search?: string })[],
  typed: string,
): Completion[] | undefined {
  if (![...typed].some((c) => c.charCodeAt(0) > 0x7f)) return undefined;
  const name = (option: Completion) =>
    String(option.displayLabel ?? option.label).replace(/^[@%#]/, "");
  return pickByFold(
    options,
    typed,
    (option) => option.search ?? name(option),
    name,
  ).slice(0, MAX_FOLDED);
}

const RE_emojiValidFor = /(?<!\p{L}\w):[\p{L}\w\-+]*/u;
// CodeMirror's own list (asked for once, then narrowed by it) stays only
// while the text is ASCII. The first letter outside it asks again, and the
// names are then compared folded: the list given for "@" used to be kept,
// narrowed letter by letter, and «مصطفي» lost «مصطفى» at its last letter.
const RE_mentionValidFor = /(?<!\p{L}\w)@[\w\-+]*$/u;
const RE_roleValidFor = /(?<!\p{L}\w)%[\w\-+]*$/u;
const RE_channelValidFor = /(?<!\p{L}\w)#[\w\-+]*$/u;

export function codeMirrorAutoCompleteSource(
  searchSpace: Accessor<AutoCompleteSearchSpace>,
) {
  const state = useState();
  const client = useClient();

  const emoji = createMemo(() => {
    return ([] as Completion[]).concat(
      MAPPED_EMOJI_KEYS.map((emoji) => ({
        ...emoji,
        apply: `${isRegionalIndicator(emoji.apply as string) ? UNICODE_ZWNJ : ""}${emoji.apply as string}`,
        url: unicodeEmojiUrl(
          state.settings.getValue("appearance:unicode_emoji"),
          emoji.apply as string,
        ),
      })),
      client().emojis.map((emoji) => ({
        type: "emoji",
        label: `:${emoji.name}:`,
        apply: `:${emoji.id}: `,
        url: emoji.url,
      })),
    );
  });

  const users = createMemo(() =>
    (
      searchSpace()?.members ??
      searchSpace()?.users ??
      client().users.toList()
    ).map((entry) => {
      // avoiding using `instanceof`, presumed slow
      const user = ((entry as { user: User })?.user ?? entry) as User;

      // Only hit the store once to reduce watchers.
      // If you need to access anything on the member more than once define a const here.
      const displayName = entry.displayName;
      const userName = user.username;
      const id = entry.id;

      return {
        type: "user",
        label: ("@" + displayName).normalize("NFKC"),
        displayLabel: displayName,
        // found by the name shown or by the username
        search: `${displayName} ${userName}`,
        detail: displayName !== userName ? userHandle(user) : undefined,
        apply: `<@${typeof id === "string" ? id : id.user}> `,
        url: entry.animatedAvatarURL,
      };
    }),
  );

  // @everyone and @here, for those who may ping them, after the people
  const massMentions = createMemo((): Completion[] =>
    searchSpace()?.massMentions
      ? [
          {
            type: "everyone",
            label: "@everyone",
            detail: t`Everyone in this channel`,
            apply: "@everyone ",
            glyph: "users-three",
          } as Completion,
          {
            type: "everyone",
            label: "@here",
            detail: t`Everyone online in this channel`,
            apply: "@here ",
            glyph: "users",
          } as Completion,
        ]
      : [],
  );
  const people = createMemo(() => [...users(), ...massMentions()]);

  const roles = createMemo(() => {
    return (
      searchSpace()?.roles?.map(
        (entry) =>
          ({
            type: "role",
            label: ("%" + entry.name).normalize("NFKC"),
            displayLabel: entry.name,
            apply: `<%${entry.id}> `,
            colour: entry.colour,
          }) as Completion,
      ) ?? []
    );
  });

  const channels = createMemo(() =>
    (searchSpace()?.channels ?? client().channels.toList()).map(
      (entry) =>
        ({
          type: "channel",
          label: ("#" + entry.name).normalize("NFKC"),
          // the room's icon says what it is: the name alone
          displayLabel: entry.name,
          apply: `<#${entry.id}> `,
          glyph: channelGlyph(entry),
          url: entry.iconURL,
        }) as Completion,
    ),
  );

  // Names are answered again on the same keystroke (CodeMirror's `update`),
  // not after its typing delay: while a list waited to be asked again, the
  // old one stayed on screen and Enter sent the message with "@احم" in it
  // instead of picking the name.
  const again = (
    _current: CompletionResult,
    _from: number,
    _to: number,
    next: CompletionContext,
  ) => source(next);

  const source = (context: CompletionContext): CompletionResult | null => {
    if (isInCodeBlock(context.state, context.pos, context.pos)) {
      return null;
    }

    const token = context.matchBefore(RE_match);
    if (!token) return null;
    const normalizedText = token.text.normalize("NFKC");
    // the list filtered here (text outside ASCII)
    const folded = (options: Completion[]) => {
      const matches = foldedOptions(options, normalizedText.slice(1));
      return (
        matches &&
        ({
          from: token.from,
          options: matches,
          filter: false,
          update: again,
        } as CompletionResult)
      );
    };
    switch (normalizedText[0]) {
      case ":":
        return {
          from: token.from,
          options: emoji(),
          validFor: RE_emojiValidFor,
        } as CompletionResult;
      case "@":
        return (
          folded(people()) ??
          ({
            from: token.from,
            options: people(),
            validFor: RE_mentionValidFor,
            update: again,
          } as CompletionResult)
        );
      case "%":
        return (
          folded(roles()) ??
          ({
            from: token.from,
            options: roles(),
            validFor: RE_roleValidFor,
            update: again,
          } as CompletionResult)
        );
      case "#":
        return (
          folded(channels()) ??
          ({
            from: token.from,
            options: channels(),
            validFor: RE_channelValidFor,
            update: again,
          } as CompletionResult)
        );
      default:
        return null;
    }
  };

  return source;
}
