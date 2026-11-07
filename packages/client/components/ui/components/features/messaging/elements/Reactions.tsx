import { For, Show, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useMessage } from "@revolt/app";
import { Emoji } from "@revolt/markdown";
import { useUsers } from "@revolt/markdown/users";
import { Tooltip } from "@revolt/ui/components/floating";
import { Icon } from "@revolt/ui/icons/Icon";

interface Props {
  /**
   * Reactions data
   */
  reactions?: Map<string, Set<string>>;

  /**
   * Interactions
   */
  interactions: API.Message["interactions"];

  /**
   * ID of current user
   */
  userId?: string;

  /**
   * Add a reaction
   * @param reaction ID
   */
  addReaction(reaction: string): void;

  /**
   * Nothing new can be added here; a person's own reaction can still go
   */
  readOnly?: boolean;

  /**
   * Remove a reaction
   * @param reaction ID
   */
  removeReaction(reaction: string): void;
}

/**
 * Message reactions: one row of equal-height chips [emoji count], then an
 * add button that appears on hover
 */
export function Reactions(props: Props) {
  const { t } = useLingui();
  const { reactPicker } = useMessage();

  /**
   * Determine two lists of 'required' and 'optional' reactions
   */
  const lists = createMemo(() => {
    const required = new Set<string>();
    const optional = new Set<string>();

    if (props.interactions?.reactions) {
      for (const reaction of props.interactions.reactions) {
        required.add(reaction);
      }
    }

    if (props.reactions) {
      for (const key of props.reactions.keys()) {
        if (!required.has(key)) {
          optional.add(key);
        }
      }
    }

    return {
      required: Array.from(required),
      optional: Array.from(optional),
    };
  });

  /**
   * Determine whether we are showing any reactions
   * @param both Whether to check if both are present
   * @returns Number of either required or optional if present
   */
  const hasReactions = (both?: boolean) => {
    const { required, optional } = lists();
    return both
      ? required.length && optional.length
      : required.length || optional.length;
  };

  let reactRef!: HTMLDivElement;

  return (
    <Show when={hasReactions()}>
      <List role="group" aria-label={t`Reactions`}>
        <For each={lists().required}>
          {(entry) => (
            <Reaction
              reaction={entry}
              active={props.reactions?.get(entry)?.has(props.userId!)}
              users={props.reactions?.get(entry)}
              readOnly={props.readOnly}
              addReaction={props.addReaction}
              removeReaction={props.removeReaction}
            />
          )}
        </For>
        <Show when={hasReactions(true)}>
          <Divider aria-hidden="true" />
        </Show>
        <For each={lists().optional}>
          {(entry) => (
            <Reaction
              reaction={entry}
              active={props.reactions?.get(entry)?.has(props.userId!)}
              users={props.reactions?.get(entry)}
              readOnly={props.readOnly}
              addReaction={props.addReaction}
              removeReaction={props.removeReaction}
            />
          )}
        </For>
        <Show when={!props.readOnly}>
          <AddAnchor ref={reactRef}>
            <AddReaction
              type="button"
              class="add"
              aria-label={t`Add reaction`}
              title={t`Add reaction`}
              onClick={(e) => reactPicker!()?.onClickEmoji(e, reactRef)}
            >
              <Icon name="smiley" size={18} />
              <Plus aria-hidden="true">+</Plus>
            </AddReaction>
          </AddAnchor>
        </Show>
      </List>
    </Show>
  );
}

/**
 * Render the reaction
 */
function Reaction(props: {
  reaction: string;
  active?: boolean;
  users?: Set<string>;
  readOnly?: boolean;
  addReaction(id: string): void;
  removeReaction(id: string): void;
}) {
  const { t } = useLingui();
  const users = useUsers(() => [...(props.users?.values() ?? [])], false, true);

  /**
   * Handle toggling reaction
   */
  function onClick() {
    if (props.active) {
      props.removeReaction(props.reaction);
    } else {
      props.addReaction(props.reaction);
    }
  }

  /**
   * Generate list of users
   */
  const peopleList = () => {
    const all = users();
    const list = all.filter((user) => user);
    const unknown =
      all.filter((user) => !user).length + Math.max(0, list.length - 3);

    const usernames = list
      .slice(0, 2)
      .map((user) => user?.username)
      .join(", ");

    if (unknown) {
      if (usernames) {
        return t`${usernames} and ${unknown} others reacted`;
      } else if (unknown === 1) {
        return t`1 person reacted`;
      } else {
        return t`${unknown} reacted`;
      }
    } else {
      return t`${usernames} reacted`;
    }
  };

  return (
    <Tooltip
      placement="top"
      content={() => (
        <TooltipBody>
          <TooltipEmoji>
            <Emoji emoji={props.reaction} />
          </TooltipEmoji>
          <PeopleList>{peopleList()}</PeopleList>
        </TooltipBody>
      )}
      aria={peopleList()}
    >
      <Chip
        type="button"
        aria-pressed={!!props.active}
        aria-label={peopleList()}
        data-active={props.active || undefined}
        disabled={props.readOnly && !props.active}
        onClick={onClick}
      >
        <EmojiBox aria-hidden="true">
          <Emoji emoji={props.reaction} />
        </EmojiBox>
        <Count>{props.users?.size || 0}</Count>
      </Chip>
    </Tooltip>
  );
}

const chipBase = {
  boxSizing: "border-box",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  margin: 0,
  border: "1px solid var(--z-border-subtle)",
  borderRadius: "999px",
  background: "var(--z-bg-raised)",
  cursor: "pointer",
  userSelect: "none",
  transition:
    "background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease",
  // the finger needs the height, the row keeps its size
  _phone: { height: "32px", minWidth: "44px", justifyContent: "center" },

  _hover: {
    borderColor: "var(--z-border-strong)",
  },
  "&:active": { scale: "0.96" },
  _focusVisible: {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "1px",
  },
  _motionReduce: { transition: "none", "&:active": { scale: "1" } },
} as const;

/**
 * One reaction: fixed 18px emoji box and a small tabular count, so every
 * chip is the same height whatever the emoji pack or number
 */
const Chip = styled("button", {
  base: {
    ...chipBase,
    gap: "6px",
    paddingInline: "8px 10px",
    color: "var(--z-fg-secondary)",

    "&[data-active]": {
      color: "var(--z-accent-text, var(--z-accent))",
      borderColor: "var(--z-accent)",
      background: "var(--z-accent-muted)",
    },
  },
});

const EmojiBox = styled("span", {
  base: {
    flexShrink: 0,
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // never clip: font emoji draw wider than their font size
    overflow: "visible",
    "--emoji-size": "18px",

    // image packs and custom emoji fill the box exactly
    "& img.emoji": {
      display: "block",
      width: "18px",
      height: "18px",
      margin: 0,
      objectFit: "contain",
    },

    // font emoji (Segoe UI Emoji draws ~1.4em wide): keep the 18px slot
    // but centre the glyph in it, so any overflow is shared by both sides
    // and covered by the chip padding instead of being cut off
    "& span.emoji": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "18px",
      height: "18px",
      margin: 0,
      padding: 0,
      fontSize: "16px",
      lineHeight: 1,
      whiteSpace: "nowrap",
    },
  },
});

const Count = styled("span", {
  base: {
    minWidth: "1ch",
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
});

/**
 * Add-reaction chip: same height, shown while hovering the message or when
 * focused; always shown on touch screens
 */
const AddReaction = styled("button", {
  base: {
    ...chipBase,
    position: "relative",
    justifyContent: "center",
    width: "36px",
    padding: 0,
    opacity: 0,
    color: "var(--z-icon-muted)",
    "--z-icon-color": "currentColor",

    _hover: {
      color: "var(--z-icon-hover)",
      borderColor: "var(--z-border-strong)",
    },
    _focusVisible: { opacity: 1 },
    // the message row carries the "group" class
    _groupHover: { opacity: 1 },

    "@media (hover: none)": { opacity: 1 },
  },
});

const Plus = styled("span", {
  base: {
    position: "absolute",
    top: "1px",
    insetInlineEnd: "5px",
    fontSize: "11px",
    lineHeight: "11px",
    fontWeight: 700,
  },
});

/** Anchor for the emoji picker (it positions against a div) */
const AddAnchor = styled("div", {
  base: {
    display: "inline-flex",
  },
});

/**
 * Divider between required and optional reactions
 */
const Divider = styled("div", {
  base: {
    width: "1px",
    height: "16px",
    marginInline: "2px",
    background: "var(--z-border-strong)",
  },
});

/**
 * Base component for the reactions list
 */
const List = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px",
    _phone: { gap: "8px" },
  },
});

const TooltipBody = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
});

const TooltipEmoji = styled("span", {
  base: {
    flexShrink: 0,
    "--emoji-size": "32px",
    fontSize: "28px",
  },
});

/**
 * List of people who have reacted
 */
const PeopleList = styled("span", {
  base: {
    lineClamp: 2,
    maxWidth: "200px",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    textOverflow: "ellipsis",
  },
});
