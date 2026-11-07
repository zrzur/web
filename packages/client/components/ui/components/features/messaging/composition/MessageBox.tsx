import { Accessor, JSX, Match, Show, Switch, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { AutoCompleteSearchSpace } from "@revolt/ui/components/utils/autoComplete";

import { Icon } from "@revolt/ui/icons/Icon";
import { TextEditor2 } from "../../texteditor/LazyTextEditor2";

interface Props {
  /**
   * Initial content
   */
  initialValue: readonly [string];

  /**
   * Node replacement
   */
  nodeReplacement?: readonly [string | "_focus"];

  /**
   * Text content
   */
  content: string;

  /**
   * Handle event to send message
   */
  onSendMessage: () => void;

  /**
   * Handle event when user is typing
   */
  onTyping: () => void;

  /**
   * Handle event when user wants to edit the last message in chat
   */
  onEditLastMessage: () => void;

  /**
   * Update text content
   * @param v New content
   */
  setContent: (v: string) => void;

  /**
   * Actions to the left of the message box
   */
  actionsStart: JSX.Element;

  /**
   * Actions to the right of the message box
   */
  actionsEnd: JSX.Element;

  /**
   * Elements appended after the message box row
   */
  actionsAppend: JSX.Element;

  /**
   * Whether there are elements appended after the message box row
   */
  hasActionsAppend: boolean;

  /**
   * Placeholder in message box
   */
  placeholder: string;

  /**
   * Whether sending messages is allowed
   */
  sendingAllowed: boolean;

  /**
   * Whether the user is currently timed out in this channel/server
   */
  timeoutActive?: boolean;

  /**
   * Read-only because this is an announcement channel
   */
  announcementOnly?: boolean;

  /**
   * Auto complete config
   */
  autoCompleteSearchSpace?: Accessor<AutoCompleteSearchSpace>;

  /**
   * Update the current draft selection
   *
   * @deprecated have to hook into ProseMirror instance now!
   */
  updateDraftSelection?: (start: number, end: number) => void;
}

/**
 * Message box container
 */
const Base = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    boxSizing: "border-box",
    // same floating card as the account panel (height, colour, radius, lift)
    minHeight: "var(--z-dock-height, 56px)",
    // first icon row = 40px; pad so a single line centres in --z-dock-height
    // (56 − 2 border − 40) / 2 ≈ 7 — same optical centre as AccountBar
    paddingBlock: "7px",
    paddingInline: "7px",
    borderRadius: "var(--z-dock-radius, 12px)",
    border: "1px solid var(--z-dock-border)",
    boxShadow: "var(--z-dock-lift)",
    background: "var(--z-dock-bg)",
    transition:
      "border-color var(--z-motion-fast, 120ms) ease, box-shadow var(--z-motion-base, 220ms) var(--z-ease-standard, ease)",
    _motionReduce: { transition: "none" },
    "&:focus-within": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-dock-focus-lift)",
    },

    display: "flex",
    alignItems: "flex-start",
    gap: "2px",
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    "--z-icon-color": "var(--z-icon-muted)",
    "& button:hover": {
      "--z-icon-color": "var(--z-icon-hover)",
    },
  },
  variants: {
    hasActionsAppend: {
      true: {},
      false: {},
    },
  },
  defaultVariants: {
    hasActionsAppend: false,
  },
});

const Parent = styled("div", {
  base: {
    flexGrow: 1,
    flexShrink: 0,

    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    // same distance from the window bottom as the account panel
    margin: "0 0 var(--z-dock-gap, 8px) 0",
    maxHeight: "var(--layout-height-message-box)",
  },
});

/**
 * Blocked message
 */
const Blocked = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    // same height as the icon slot, so icon and text share one centre line
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    paddingBlock: "8px",
    paddingInlineEnd: "8px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    userSelect: "none",
  },
});

/** Icon in front of the blocked message, sized like the other composer icons */
const BlockedIcon = styled("span", {
  base: {
    display: "inline-flex",
    color: "var(--z-fg-muted)",
  },
});

/**
 * Specific-width icon container
 */
export const InlineIcon = styled("div", {
  base: {
    flexShrink: 0,
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    size: {
      short: { width: "10px" },
      normal: { width: "40px" },
    },
    ready: {
      true: {
        "--z-icon-color": "var(--z-on-accent)",
        "& button": {
          background: "var(--z-accent-fill)",
          borderRadius: "10px",
          "--z-icon-color": "var(--z-on-accent)",
        },
        "& button:hover": {
          background: "var(--z-accent-hover)",
          "--z-icon-color": "var(--z-on-accent) !important",
        },
        "& button:active": { background: "var(--z-accent-pressed)" },
      },
      false: { opacity: 0.4 },
    },
  },
  defaultVariants: {
    size: "normal",
  },
});

const FloatingAction = styled("div", {
  base: {
    flexShrink: 0,
    flexGrow: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "end",
  },
  variants: {
    size: {
      short: {
        height: "1em",
      },
      normal: {
        height: "1.5em",
      },
      tall: {
        height: "2em",
      },
    },
    error: {
      true: {
        color: "var(--z-danger, var(--md-sys-color-error))",
      },
    },
  },
});

const ActionContainer = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    flexGrow: 1,
  },
  variants: {
    column: {
      true: {
        flexFlow: "column",
      },
    },
  },
});

/**
 * Message box
 */
export function MessageBox(props: Props) {
  // props.updateDraftSelection?.(
  //   event.currentTarget.selectionStart,
  //   event.currentTarget.selectionEnd,
  // );

  /**
   * Set initial draft selection
   */
  onMount(() =>
    props.updateDraftSelection?.(props.content.length, props.content.length),
  );

  return (
    <Parent>
      <Base hasActionsAppend={props.hasActionsAppend}>
        <Switch fallback={props.actionsStart}>
          <Match when={props.timeoutActive || !props.sendingAllowed}>
            <InlineIcon>
              <BlockedIcon>
                <Icon name="prohibit" size={20} />
              </BlockedIcon>
            </InlineIcon>
          </Match>
        </Switch>
        <Switch
          fallback={
            <>
              <TextEditor2
                placeholder={props.placeholder}
                initialValue={props.initialValue}
                nodeReplacement={props.nodeReplacement}
                onChange={props.setContent}
                onComplete={props.onSendMessage}
                onTyping={props.onTyping}
                onPreviousContext={props.onEditLastMessage}
                autoCompleteSearchSpace={props.autoCompleteSearchSpace}
              />
              <Show when={props.sendingAllowed}>{props.actionsEnd}</Show>
            </>
          }
        >
          <Match when={props.timeoutActive}>
            <Blocked>
              <Trans>
                You are timed out and can't send messages right now.
              </Trans>
            </Blocked>
          </Match>
          <Match when={props.announcementOnly}>
            <Blocked>
              <Trans>
                This is an announcement channel. Only people who can manage
                messages post here.
              </Trans>
            </Blocked>
          </Match>
          <Match when={!props.sendingAllowed}>
            <Blocked>
              <Trans>
                You don't have permission to send messages in this channel.
              </Trans>
            </Blocked>
          </Match>
        </Switch>
        <Show when={props.sendingAllowed}>{props.actionsAppend}</Show>
      </Base>
    </Parent>
  );
}

MessageBox.InlineIcon = InlineIcon;

MessageBox.FloatingAction = FloatingAction;

MessageBox.ActionContainer = ActionContainer;
