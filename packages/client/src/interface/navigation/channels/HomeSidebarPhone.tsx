import { For, Show, createMemo, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { ChannelContextMenu, UserContextMenu } from "@revolt/app";
import { isOfficialChannel } from "@revolt/app/interface/support/official";
import { useClient } from "@revolt/client";
import { statusLine } from "@revolt/common/lib/statusWrite";
import { useTime } from "@revolt/i18n/dayjs";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, UserStatus } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { OfficialLabel } from "@revolt/ui/components/features/profiles/OfficialLabel";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { SidebarBase } from "./common";

interface Props {
  /** Ordered list of conversations */
  conversations: () => Channel[];
  /** Current channel ID */
  channelId?: string;
}

/**
 * The Messages screen on phones (design approved by the owner, 2026-11-16):
 * a large title, search with "add friend" and "new group", friends who are
 * online now, then every conversation with its last message, when it came
 * and how much is unread. Home, Friends, Designs and Saved notes are on the
 * You screen there, not in this list.
 */
export function HomeSidebarPhone(props: Props) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const state = useState();
  const { openModal } = useModals();

  /** type to narrow the list */
  const [query, setQuery] = createSignal("");
  const conversations = createMemo(() => {
    const q = query().trim().toLocaleLowerCase();
    if (!q) return props.conversations();
    return props
      .conversations()
      .filter((channel) =>
        (channel.recipient?.displayName ?? channel.name ?? "")
          .toLocaleLowerCase()
          .includes(q),
      );
  });

  /** friends who are online, one tap from a message */
  const onlineFriends = createMemo(() =>
    client()
      .users.filter((user) => user.relationship === "Friend" && user.online)
      .slice(0, 12),
  );

  return (
    <SidebarBase class="channel_bar home">
      {/* the directive takes the class: a class attribute beside it replaced
          the classes the directive adds, and the list could not scroll
          (owner, 2026-11-18: many conversations, no way down) */}
      <div use:invisibleScrollable={{ class: scroller }}>
        <Title>
          <Trans>Messages</Trans>
        </Title>

        <Tools>
          <SearchField>
            <Icon name="magnifying-glass" size={20} />
            <input
              type="search"
              value={query()}
              placeholder={t`Search conversations`}
              aria-label={t`Search conversations`}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </SearchField>
          <ToolButton
            type="button"
            aria-label={t`Add friend`}
            onClick={() => openModal({ type: "add_friend", client: client() })}
          >
            <Icon name="user-plus" size={22} />
          </ToolButton>
          <ToolButton
            type="button"
            data-primary
            aria-label={t`Create a new group`}
            onClick={() =>
              openModal({ type: "create_group", client: client() })
            }
          >
            <Icon name="plus" size={22} />
          </ToolButton>
        </Tools>

        <Show when={onlineFriends().length && !query()}>
          <Section>
            <Trans>Online now</Trans>
          </Section>
          <OnlineRow data-online-now>
            <For each={onlineFriends()}>
              {(user) => (
                <OnlineCard
                  type="button"
                  onClick={() =>
                    user.openDM().then((channel) => {
                      navigate(`/channel/${channel.id}`);
                      // the list and the conversation share the phone screen
                      state.appDrawer()?.setShown(true);
                    })
                  }
                >
                  <Avatar
                    size={44}
                    src={user.animatedAvatarURL}
                    fallback={user.displayName}
                    holepunch="bottom-right"
                    overlay={<UserStatus.Graphic status={user.presence} />}
                  />
                  <span>{user.displayName}</span>
                </OnlineCard>
              )}
            </For>
          </OnlineRow>
        </Show>

        <Section>
          <Trans>Conversations</Trans>
        </Section>

        <Show when={!conversations().length}>
          <Empty>
            <Show
              when={query()}
              fallback={
                <Trans>
                  Your conversations will appear here. Start a group or find a
                  friend to begin.
                </Trans>
              }
            >
              <Trans>No conversation matches your search.</Trans>
            </Show>
          </Empty>
        </Show>

        <div role="list">
          <For each={conversations()}>
            {(channel) => (
              <Entry
                channel={channel}
                active={channel.id === props.channelId}
              />
            )}
          </For>
        </div>
      </div>
    </SidebarBase>
  );
}

/** One conversation: avatar, name and time, last message and unread count */
function Entry(props: { channel: Channel; active: boolean }) {
  const { t } = useLingui();
  const dayjs = useTime();
  const client = useClient();
  const state = useState();

  /** when the last message came, short: the time today, else the day */
  const when = createMemo(() => {
    const at = props.channel.lastMessageAt;
    if (!at) return undefined;
    const then = dayjs(at);
    const now = dayjs();
    if (then.isSame(now, "day")) return then.format("LT");
    if (then.isSame(now.subtract(1, "day"), "day")) return t`Yesterday`;
    if (now.diff(then, "day") < 7) return then.format("dddd");
    return then.format("L");
  });

  /**
   * The last message in one line, when this device has it (messages are kept
   * only for conversations that were opened or got a new message)
   */
  const preview = createMemo(() => {
    const message = props.channel.lastMessage;
    if (!message || message.systemMessage) return undefined;
    const text =
      message.contentPlain?.trim() ||
      (message.attachments?.length ? t`Sent an attachment` : "");
    if (!text) return undefined;
    return message.author?.id === client().user?.id ? t`You: ${text}` : text;
  });

  /** without a message to show: the person's status line */
  const status = createMemo(() =>
    statusLine(
      props.channel.recipient?.statusEmoji,
      props.channel.recipient?.statusMessage((s) =>
        s === "Online"
          ? t`Online`
          : s === "Busy"
            ? t`Busy`
            : s === "Focus"
              ? t`Focus`
              : s === "Idle"
                ? t`Idle`
                : t`Offline`,
      ),
    ),
  );

  const unread = () => !props.active && props.channel.unread;
  const mentions = () => props.channel.mentions?.size ?? 0;
  const group = () => props.channel.type === "Group";

  return (
    <a
      role="listitem"
      class={row}
      href={`/channel/${props.channel.id}`}
      data-active={props.active}
      data-unread={unread() ? "true" : undefined}
      aria-current={props.active ? "page" : undefined}
      // the list and the conversation share the phone screen: the link moves
      // the route, this brings the conversation on screen (also when the row
      // is the conversation already open)
      onClick={() => state.appDrawer()?.setShown(true)}
      use:floating={{
        contextMenu: () =>
          group() ? (
            <ChannelContextMenu channel={props.channel} />
          ) : (
            <UserContextMenu
              user={props.channel.recipient!}
              channel={props.channel}
            />
          ),
      }}
    >
      <Show
        when={!group()}
        fallback={
          <Avatar
            size={44}
            shape="rounded-square"
            fallback={props.channel.name}
            src={props.channel.iconURL}
            primaryContrast
          />
        }
      >
        <AvatarDecoration
          decoration={props.channel.recipient?.style?.decoration}
          file={props.channel.recipient?.style?.decoration_file}
          size={44}
        >
          {/* official accounts are the system, not people: no online dot */}
          <Show
            when={!isOfficialChannel(props.channel)}
            fallback={<Avatar size={44} src={props.channel.iconURL} />}
          >
            <Avatar
              size={44}
              src={props.channel.iconURL}
              holepunch="bottom-right"
              overlay={
                <UserStatus.Graphic
                  status={props.channel.recipient?.presence}
                />
              }
            />
          </Show>
        </AvatarDecoration>
      </Show>

      <Text>
        <Line>
          <Name>
            <Show
              when={!group()}
              fallback={<TextWithEmoji content={props.channel.name!} />}
            >
              <span style={nameStyle(props.channel.recipient?.style)}>
                {props.channel.recipient?.displayName}
              </span>
              <Show when={isOfficialChannel(props.channel)}>
                {" "}
                <OfficialLabel />
              </Show>
            </Show>
          </Name>
          <Show when={when()}>
            <When>{when()}</When>
          </Show>
        </Line>
        <Line>
          <Sub>
            <Show
              when={preview()}
              fallback={
                <Show
                  when={!group()}
                  fallback={
                    <Plural
                      value={props.channel.recipientIds.size}
                      one="# member"
                      other="# members"
                    />
                  }
                >
                  <Show when={status()}>
                    <TextWithEmoji content={status()!} />
                  </Show>
                </Show>
              }
            >
              <TextWithEmoji content={preview()!} />
            </Show>
          </Sub>
          <Show when={unread()}>
            <Unread aria-label={t`Unread`}>
              {mentions() > 99 ? "99+" : mentions() || ""}
            </Unread>
          </Show>
        </Line>
      </Text>
    </a>
  );
}

// a native element: the scroll directive does not pass through a component
const scroller = css({
  flex: "1 1 auto",
  minHeight: 0,
});

const Title = styled("h1", {
  base: {
    margin: 0,
    padding: "calc(16px + var(--z-phone-top-gap, 0px)) 16px 0",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.3,
    color: "var(--z-fg-primary)",
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    gap: "10px",
    padding: "12px 16px",
  },
});

const SearchField = styled("label", {
  base: {
    flex: 1,
    minWidth: 0,
    // drawn 36 px; the area that takes the touch is 44 (the ::after)
    height: "36px",
    position: "relative",
    "&::after": { content: '""', position: "absolute", inset: "-4px 0" },
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingInline: "12px",
    borderRadius: "12px",
    color: "var(--z-fg-muted)",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    "--z-icon-color": "currentColor",
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
    },
    "&:focus-within": { boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const ToolButton = styled("button", {
  base: {
    flex: "none",
    // drawn 36 px; the area that takes the touch is 44 (the ::after)
    width: "36px",
    height: "36px",
    position: "relative",
    "&::after": { content: '""', position: "absolute", inset: "-4px" },
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    "--z-icon-color": "currentColor",
    // the one action of this screen: start something new
    "&[data-primary]": {
      color: "var(--z-on-accent, #FFFFFF)",
      background: "var(--z-accent)",
    },
    _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const Section = styled("h2", {
  base: {
    margin: 0,
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/** Online friends side by side; swipes sideways when they do not fit */
const OnlineRow = styled("div", {
  base: {
    display: "flex",
    gap: "10px",
    padding: "0 16px 10px",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
});

const OnlineCard = styled("button", {
  base: {
    flex: "none",
    width: "76px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "12px 6px 8px",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    font: "inherit",
    fontSize: "12px",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    background: "var(--z-bg-raised)",
    "& > span:last-child": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const row = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "62px",
  margin: "0 8px",
  padding: "9px 8px",
  borderRadius: "14px",
  textDecoration: "none",
  color: "var(--z-fg-muted)",
  WebkitTapHighlightColor: "transparent",
  "&[data-active='true']": { background: "var(--z-bg-raised)" },
  "&[data-unread='true']": { color: "var(--z-fg-primary)" },
  _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
});

const Text = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const Line = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minWidth: 0,
  },
});

const Name = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const When = styled("time", {
  base: {
    flex: "none",
    fontSize: "12px",
    fontWeight: 400,
    color: "var(--z-fg-muted)",
    whiteSpace: "nowrap",
  },
});

const Sub = styled("span", {
  base: {
    minWidth: 0,
    minHeight: "20px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "14px",
  },
});

/** A count when there are mentions, a plain dot for other unread messages */
const Unread = styled("span", {
  base: {
    flex: "none",
    minWidth: "10px",
    height: "10px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--z-on-mention-badge, #FFFFFF)",
    background: "var(--z-mention-badge, #C2337A)",
    "&:not(:empty)": {
      minWidth: "20px",
      height: "20px",
      paddingInline: "6px",
    },
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "4px 16px",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "var(--z-fg-muted)",
  },
});
