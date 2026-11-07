import { JSX, Match, Show, Switch, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { css, cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useMessage } from "@revolt/app";
import { useDevice } from "@revolt/common";
import { Ripple, typography } from "@revolt/ui/components/design";
import { Column, Row } from "@revolt/ui/components/layout";
import {
  NonBreakingText,
  OverflowingText,
  Symbol,
  Time,
} from "@revolt/ui/components/utils";

import { MessageToolbar } from "./MessageToolbar";

interface CommonProps {
  /**
   * Whether this is the tail of another message
   */
  tail?: boolean;

  /**
   * Whether to move the username and related to the left
   *
   * If you want to hide it completely, add a <Match when={true} /> to infoMatch
   */
  compact?: boolean;

  /**
   * Whether this message should be treated as a link
   */
  isLink?: boolean | "hide";
}

type Props = CommonProps & {
  /**
   * Avatar URL
   */
  avatar: JSX.Element;

  /**
   * Pronouns
   */
  pronouns?: string;

  /**
   * Username element
   */
  username: JSX.Element;

  /**
   * Message content
   */
  children: JSX.Element;

  /**
   * Message header
   */
  header?: JSX.Element;

  /**
   * Message info line
   */
  info?: JSX.Element;

  /**
   * Timestamp message was sent at
   */
  timestamp: Date | JSX.Element;

  /**
   * Date message was edited at
   */
  edited?: Date;

  /**
   * Whether this message mentions the user
   */
  mentioned?: boolean;

  /**
   * Whether this message should be highlighted
   */
  highlight?: boolean;

  /**
   * Whether this message is being edited
   */
  editing?: boolean;

  /**
   * Send status of this message
   */
  sendStatus?: "sending" | "failed";

  /**
   * Whether we are hovering this message
   */
  onHover?: (hovering: boolean) => void;

  /**
   * Component to render message context menu
   */
  contextMenu?: () => JSX.Element;

  ref?: HTMLDivElement;

  /**
   * Additional match cases for the inline-start information element
   */
  infoMatch?: JSX.Element;

  /**
   * Reference time to render timestamps from
   */
  _referenceTime?: number;
};

/**
 * Message container layout
 */
const base = cva({
  base: {
    position: "relative",

    display: "flex",
    flexDirection: "column",

    padding: "2px 0",
    background: "transparent",
    minHeight: "1em",
    // quiet start-edge bar for mentions (identity without noise)
    borderInlineStart: "2px solid transparent",

    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },

    "& a:hover": {
      textDecoration: "underline",
    },

    "&:hover .Toolbar": {
      display: "flex",
    },
    "&:has(.z-media-player--audio .z-media-volume:hover) > .Toolbar, &:has(.z-media-player--audio .z-media-volume :focus-visible) > .Toolbar":
      {
        visibility: "hidden",
        pointerEvents: "none",
      },
  },
  variants: {
    // grouping: a first message opens with air, the rest of the group sits
    // close so one person's run reads as one thought
    tail: {
      true: {
        marginTop: 0,
        paddingBlock: "1px",
      },
      false: {
        marginTop: "calc(var(--message-group-spacing) + 4px)",
      },
    },
    mentioned: {
      true: {
        background:
          "var(--z-mention-bg, var(--md-sys-color-primary-container))",
        borderInlineStartColor: "var(--z-mention-bar, var(--z-highlight))",
      },
    },
    highlight: {
      true: {
        animation: "highlightMessage 3s",
      },
    },
    sendStatus: {
      failed: {
        color: "var(--z-danger, var(--md-sys-color-error))",
      },
      sending: {
        color: "var(--z-fg-muted, var(--md-sys-color-outline))",
      },
      sent: {
        color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
      },
    },
    isLink: {
      true: {
        cursor: "pointer",
        userSelect: "none",
        position: "relative",

        "& *": {
          pointerEvents: "none",
        },
      },
      false: {
        // a light step of the theme's own hover colour
        // only where hovering exists: on a touch screen :hover would stay on
        // the last message tapped
        "@media (hover: hover)": {
          "&:hover": {
            background: "var(--z-message-hover, var(--z-nav-hover))",
          },
        },
      },
      hide: {},
    },
    iOSTouch: {
      true: {
        "-webkit-touch-callout": "none",
        "-webkit-user-select": "none",
        "user-select": "none",
      },
    },
  },
  defaultVariants: {
    tail: false,
    isLink: false,
    sendStatus: "sent",
  },
});

/**
 * Left-side information or avatar
 */
const Info = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    padding: "2px 0 0",
  },
  variants: {
    tail: {
      true: {
        padding: 0,
      },
    },
    compact: {
      true: {},
      false: {
        // 12 + 36 avatar + 12: the text column starts on the same line at any
        // width, 62 px in with the mention bar
        width: "60px",
      },
    },
  },
  defaultVariants: {
    compact: false,
  },
});

/**
 * Right-side message content
 */
const Body = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",

    minWidth: 0,
    overflow: "hidden",
    paddingInlineEnd: "16px",
  },
  variants: {
    editing: {
      true: {
        flexGrow: 1,
        overflow: "visible",
      },
    },
  },
});

const Content = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    gap: "4px",
    flexDirection: "column",

    ...typography.raw({ class: "_messages" }),
    // Arabic gets two more pixels of leading (design direction §4)
    lineHeight: "1.5",
    _rtl: { lineHeight: "1.625" },

    // each line reads in its own direction, but stays against the same edge
    // as the name above it: in an Arabic interface an English line used to
    // sit far across the screen from its author
    "& [dir='auto']": { textAlign: "start" },
    "& p[dir='auto'], & li[dir='auto'], & blockquote[dir='auto'], & h1[dir='auto'], & h2[dir='auto'], & h3[dir='auto']":
      { unicodeBidi: "plaintext" },
    ":root:not([dir='rtl']) &": {
      "& p[dir='auto'], & li[dir='auto'], & blockquote[dir='auto'], & h1[dir='auto'], & h2[dir='auto'], & h3[dir='auto']":
        { textAlign: "left" },
    },
    ":root[dir='rtl'] &": {
      "& p[dir='auto'], & li[dir='auto'], & blockquote[dir='auto'], & h1[dir='auto'], & h2[dir='auto'], & h3[dir='auto']":
        { textAlign: "right" },
    },
  },
});

/**
 * Information text
 */
const infoText = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    color: "var(--md-sys-color-outline)",

    ...typography.raw({ class: "body", size: "small" }),
  },
  variants: {
    prefix: {
      true: {
        width: "60px",
        fontSize: "11px",
        lineHeight: "1.5rem",

        overflow: "hidden",
        whiteSpace: "nowrap",

        display: "block",
        textAlign: "center",
      },
    },
    hidden: {
      true: {
        opacity: 0,
        transition: "var(--transitions-fast) opacity",

        _groupHover: {
          opacity: 1,
        },
      },
    },
    shrink: {
      true: {
        flexGrow: 1,
        flexBasis: 0,
        maxWidth: "fit-content",
      },
    },
  },
});

/**
 * Additional styles for compact mode
 */
const CompactInfo = styled(Row, {
  base: {
    flexShrink: 0,
    marginTop: "-2px",
    height: "fit-content",
    paddingInline: "var(--gap-lg) 0",
  },
});

/**
 * Component to show avatar, username, timestamp and content
 */
export function MessageContainer(props: Props) {
  const { t } = useLingui();
  const { message } = useMessage();
  const { isMobile, isIOSTouch } = useDevice();

  // the toolbar shows on hover only, and drawing one for every row was a fifth
  // of the time of a channel switch: it is made the first time it is needed
  const [wanted, setWanted] = createSignal(false);

  return (
    <div
      id={message?.id}
      ref={props.ref}
      onMouseEnter={() => {
        setWanted(true);
        props.onHover?.(true);
      }}
      onMouseLeave={() => props.onHover && props.onHover(false)}
      class={
        "group " +
        base({
          tail: props.tail,
          mentioned: props.mentioned,
          highlight: props.highlight,
          sendStatus: props.sendStatus,
          isLink: props.isLink,
          iOSTouch: isIOSTouch,
        })
      }
      use:floating={{ contextMenu: props.contextMenu }}
    >
      <Show
        when={
          wanted() &&
          !isMobile &&
          message &&
          !message.author?.official &&
          props.isLink !== true &&
          props.isLink !== "hide"
        }
      >
        <MessageToolbar />
      </Show>

      <Show when={props.isLink}>
        <Ripple />
      </Show>

      {props.header}
      <Row>
        <Info tail={props.tail} compact={props.compact}>
          <Switch fallback={props.avatar}>
            {props.infoMatch ?? <Match when={false} children={null} />}
            <Match when={props.compact}>
              <CompactInfo gap="sm" align>
                <div
                  class={infoText()}
                  use:floating={{
                    tooltip: {
                      placement: "top",
                      content: () => (
                        <Column>
                          <span>
                            {t`Sent`}{" "}
                            <Time
                              format="datetime"
                              value={props.timestamp}
                              referenceTime={props._referenceTime}
                            />
                          </span>
                          <Show when={props.edited}>
                            <span>
                              {t`Edited`}{" "}
                              <Time
                                format="datetime"
                                value={props.edited}
                                referenceTime={props._referenceTime}
                              />
                            </span>
                          </Show>
                        </Column>
                      ),
                      aria: "",
                    },
                  }}
                >
                  <Time
                    format="time"
                    value={props.timestamp}
                    referenceTime={props._referenceTime}
                  />
                </div>
                {props.username}
                {props.info}
                <Show when={props.edited}>
                  <Symbol size={16}>edit</Symbol>
                </Show>
              </CompactInfo>
            </Match>
            <Match when={props.tail}>
              <div
                class={infoText({ hidden: !props.edited, prefix: true })}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: () => (
                      <Column>
                        <span>
                          {t`Sent`}{" "}
                          <Time
                            format="datetime"
                            value={props.timestamp}
                            referenceTime={props._referenceTime}
                          />
                        </span>
                        <Show when={props.edited}>
                          <span>
                            {t`Edited`}{" "}
                            <Time
                              format="datetime"
                              value={props.edited}
                              referenceTime={props._referenceTime}
                            />
                          </span>
                        </Show>
                      </Column>
                    ),
                    aria: "",
                  },
                }}
              >
                <Show
                  when={props.edited}
                  fallback={
                    <Time
                      value={props.timestamp}
                      format="time"
                      referenceTime={props._referenceTime}
                    />
                  }
                >
                  {t`(edited)`}
                </Show>
              </div>
            </Match>
          </Switch>
        </Info>
        <Body editing={props.editing}>
          <Show when={!props.tail && !props.compact}>
            <Row gap="sm" align class={css({ minHeight: "20px" })}>
              <OverflowingText>{props.username}</OverflowingText>
              <NonBreakingText class={infoText()}>{props.info}</NonBreakingText>
              <Show when={props.pronouns}>
                <OverflowingText class={infoText({ shrink: true })}>
                  <span>{props.pronouns}</span>
                  <span>·</span>
                </OverflowingText>
              </Show>
              <NonBreakingText class={infoText()}>
                <Show
                  when={props.timestamp instanceof Date}
                  fallback={props.timestamp as JSX.Element}
                >
                  <span
                    use:floating={{
                      tooltip: {
                        placement: "top",
                        content: () => (
                          <>
                            {t`Sent`}{" "}
                            <Time
                              format="datetime"
                              value={props.timestamp}
                              referenceTime={props._referenceTime}
                            />
                          </>
                        ),
                        aria: "",
                      },
                    }}
                  >
                    <Time
                      format="calendar"
                      value={props.timestamp}
                      referenceTime={props._referenceTime}
                    />
                  </span>
                </Show>
                <Show when={props.edited}>
                  <span
                    use:floating={{
                      tooltip: {
                        placement: "top",
                        content: () => (
                          <>
                            {t`Edited`}{" "}
                            <Time
                              format="datetime"
                              value={props.edited}
                              referenceTime={props._referenceTime}
                            />
                          </>
                        ),
                        aria: "",
                      },
                    }}
                  >
                    {t`(edited)`}
                  </span>
                </Show>
              </NonBreakingText>
            </Row>
          </Show>
          <Content>{props.children}</Content>
        </Body>
      </Row>
    </div>
  );
}
