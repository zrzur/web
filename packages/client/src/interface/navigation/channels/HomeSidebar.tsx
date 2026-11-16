import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  splitProps,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { VirtualContainer } from "@minht11/solid-virtual-container";
import { Channel } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { ChannelContextMenu, UserContextMenu } from "@revolt/app";
import { useCreatorAccess } from "@revolt/app/interface/settings/user/profile/creatorAccess";
import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { statusLine } from "@revolt/common/lib/statusWrite";
import { useTime } from "@revolt/i18n/dayjs";
import Instance from "@revolt/instance/Instance";
import { TextWithEmoji } from "@revolt/markdown";
import { OfficialLabel } from "@revolt/ui/components/features/profiles/OfficialLabel";

import { isOfficialChannel } from "@revolt/app/interface/support/official";
import { useModals } from "@revolt/modal";
import { useLocation, useNavigate } from "@revolt/routing";
import {
  Avatar,
  Deferred,
  MenuButton,
  OverflowingText,
  Tooltip,
  UserStatus,
  typography,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { Icon } from "@revolt/ui/icons/Icon";
import { A } from "@solidjs/router";

import { SidebarBase } from "./common";

interface Props {
  /**
   * Ordered list of conversations
   */
  conversations: () => Channel[];

  /**
   * Current channel ID
   */
  channelId?: string;

  /**
   * Open the saved notes channel
   */
  openSavedNotes: (
    navigate?: ReturnType<typeof useNavigate>,
  ) => string | undefined;
}

/**
 * Display home navigation and conversations
 */
export const HomeSidebar = (props: Props) => {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const showStudio = useCreatorAccess();
  const inDesigns = () =>
    Instance.relPath(location.pathname).startsWith("/designs");
  const inStudio = () =>
    Instance.relPath(location.pathname).startsWith("/designs/studio");
  const location = useLocation();
  const { openModal } = useModals();
  const { isMobile, layout } = useDevice();
  const phone = () => layout() === "phone";

  /** phones: type to narrow the list of conversations */
  const [query, setQuery] = createSignal("");
  const conversations = createMemo(() => {
    const q = query().trim().toLocaleLowerCase();
    if (!phone() || !q) return props.conversations();
    return props
      .conversations()
      .filter((channel) =>
        (channel.recipient?.displayName ?? channel.name ?? "")
          .toLocaleLowerCase()
          .includes(q),
      );
  });

  /** phones: friends who are online, one tap from a message */
  const onlineFriends = createMemo(() =>
    phone()
      ? client()
          .users.filter((user) => user.relationship === "Friend" && user.online)
          .slice(0, 12)
      : [],
  );

  const savedNotesChannelId = createMemo(() => props.openSavedNotes());

  let scrollTargetElement!: HTMLDivElement;

  const pendingRequests = createMemo(() => {
    return client().users.filter((user) => user.relationship === "Incoming")
      .length;
  });

  return (
    <SidebarBase class="channel_bar home">
      <div
        ref={scrollTargetElement}
        use:invisibleScrollable
        style={{ flex: "1 1 auto", "min-height": "0" }}
      >
        <List>
          <Header>
            <Trans>Conversations</Trans>
          </Header>

          <Show when={!phone()}>
            <MenuButton
              href="/app"
              size="normal"
              icon={<Symbol>home</Symbol>}
              attention={
                Instance.relPath(location.pathname) === "/app"
                  ? "selected"
                  : "normal"
              }
            >
              <ButtonTitle>
                <Trans>Home</Trans>
              </ButtonTitle>
            </MenuButton>

            <div style={{ height: "5px" }} />

            <MenuButton
              href="/friends"
              size="normal"
              icon={<Symbol>group</Symbol>}
              attention={
                Instance.relPath(location.pathname) === "/friends"
                  ? "selected"
                  : "normal"
              }
            >
              <ButtonTitle>
                <Trans>Friends</Trans>
                <div style={{ flex: "1 1 auto" }} />
                <Show when={pendingRequests()}>
                  <PendingBadge aria-label={t`Friend requests`}>
                    {pendingRequests()}
                  </PendingBadge>
                </Show>
              </ButtonTitle>
            </MenuButton>

            <div style={{ height: "5px" }} />

            <MenuButton
              href="/designs"
              size="normal"
              icon={<Symbol>palette</Symbol>}
              attention={
                inStudio() ? "normal" : inDesigns() ? "selected" : "normal"
              }
            >
              <ButtonTitle>
                <Trans>Designs</Trans>
              </ButtonTitle>
            </MenuButton>

            <div style={{ height: "5px" }} />

            <Switch
              fallback={
                <MenuButton
                  size="normal"
                  attention={"normal"}
                  icon={<Symbol>note_stack</Symbol>}
                  onClick={() => props.openSavedNotes(navigate)}
                >
                  <ButtonTitle>
                    <Trans>Saved notes</Trans>
                  </ButtonTitle>
                </MenuButton>
              }
            >
              <Match when={savedNotesChannelId()}>
                <MenuButton
                  href={`/channel/${savedNotesChannelId()}`}
                  size="normal"
                  icon={<Symbol>note_stack</Symbol>}
                  attention={
                    props.channelId && savedNotesChannelId() === props.channelId
                      ? "selected"
                      : "normal"
                  }
                >
                  <ButtonTitle>
                    <Trans>Saved notes</Trans>
                  </ButtonTitle>
                </MenuButton>
              </Match>
            </Switch>

            <Show when={showStudio()}>
              <div style={{ height: "5px" }} />

              <MenuButton
                href="/designs/studio"
                size="normal"
                icon={<Icon name="upload-simple" size={20} />}
                attention={inStudio() ? "selected" : "normal"}
                aria-current={inStudio() ? "page" : undefined}
              >
                <ButtonTitle>
                  <Trans>Creator Studio</Trans>
                </ButtonTitle>
              </MenuButton>
            </Show>
          </Show>

          <Show when={phone()}>
            <PhoneTools>
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
                onClick={() =>
                  openModal({ type: "add_friend", client: client() })
                }
              >
                <Icon name="user-plus" size={22} />
              </ToolButton>
            </PhoneTools>
            <Chips data-home-shortcuts>
              <Chip
                href="/app"
                aria-current={
                  Instance.relPath(location.pathname) === "/app"
                    ? "page"
                    : undefined
                }
              >
                <Icon name="house" size={18} />
                <Trans>Home</Trans>
              </Chip>
              <Chip
                href="/friends"
                aria-current={
                  Instance.relPath(location.pathname) === "/friends"
                    ? "page"
                    : undefined
                }
              >
                <Icon name="users" size={18} />
                <Trans>Friends</Trans>
                <Show when={pendingRequests()}>
                  <PendingBadge aria-label={t`Friend requests`}>
                    {pendingRequests()}
                  </PendingBadge>
                </Show>
              </Chip>
              <Chip
                href="/designs"
                aria-current={inDesigns() && !inStudio() ? "page" : undefined}
              >
                <Icon name="palette" size={18} />
                <Trans>Designs</Trans>
              </Chip>
              <Chip
                href={
                  savedNotesChannelId()
                    ? `/channel/${savedNotesChannelId()}`
                    : "/app"
                }
                onClick={(event: MouseEvent) => {
                  if (savedNotesChannelId()) return;
                  event.preventDefault();
                  props.openSavedNotes(navigate);
                }}
              >
                <Icon name="notebook" size={18} />
                <Trans>Saved notes</Trans>
              </Chip>
              <Show when={showStudio()}>
                <Chip
                  href="/designs/studio"
                  aria-current={inStudio() ? "page" : undefined}
                >
                  <Icon name="upload-simple" size={18} />
                  <Trans>Creator Studio</Trans>
                </Chip>
              </Show>
            </Chips>
            <Show when={onlineFriends().length && !query()}>
              <Category>
                <Trans>Online now</Trans>
              </Category>
              <OnlineRow data-online-now>
                <For each={onlineFriends()}>
                  {(user) => (
                    <OnlineCard
                      type="button"
                      onClick={() =>
                        user
                          .openDM()
                          .then((channel) => navigate(`/channel/${channel.id}`))
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
          </Show>

          <Category>
            <Trans>Direct messages</Trans>
            <button
              type="button"
              aria-label={t`Create a new group`}
              class={css({
                cursor: "pointer",
                border: "none",
                background: "transparent",
                padding: "2px",
                color: "inherit",
                display: "flex",
                // phones: a 44 px tap target (phone rules)
                _phone: {
                  minWidth: "44px",
                  minHeight: "44px",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBlock: "-12px",
                },
              })}
              onClick={() =>
                openModal({
                  type: "create_group",
                  client: client(),
                })
              }
              use:floating={{
                tooltip: {
                  placement: "right",
                  content: t`Create a new group`,
                },
              }}
            >
              <Symbol size={20} marginTop="2px">
                add
              </Symbol>
            </button>
          </Category>
          <Show when={!conversations().length && !query()}>
            <EmptyConversations>
              <Trans>
                Your conversations will appear here. Start a group or find a
                friend to begin.
              </Trans>
            </EmptyConversations>
          </Show>

          <Deferred>
            <VirtualContainer
              items={conversations()}
              scrollTarget={scrollTargetElement}
              itemSize={{ height: phone() ? 64 : 48 }}
            >
              {(item) => (
                <div
                  style={{
                    ...item.style,
                    width: "100%",
                    "padding-block": "3px",
                  }}
                >
                  <Entry
                    // @ts-expect-error missing type on Entry
                    role="listitem"
                    tabIndex={item.tabIndex}
                    channel={item.item}
                    active={item.item.id === props.channelId}
                    isMobile={isMobile}
                    phone={phone()}
                  />
                </div>
              )}
            </VirtualContainer>
          </Deferred>
        </List>
      </div>
    </SidebarBase>
  );
};

export const Header = styled("div", {
  base: {
    alignItems: "center",
    fontWeight: 600,
    userSelect: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    // phones: room above the row, as on every screen header (styles.css)
    boxSizing: "border-box",
    paddingTop: "var(--z-phone-top-gap, 0px)",
    height: "calc(var(--z-header-height, 56px) + var(--z-phone-top-gap, 0px))",
    lineHeight: "var(--z-header-height, 56px)",
    verticalAlign: "middle",
    margin: 0,
    paddingInline: "16px",
    borderBottom: "1px solid var(--z-border-subtle)",
    position: "sticky",
    top: 0,
    zIndex: 2,
    flexShrink: 0,
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    backgroundColor: "var(--z-bg-nav, var(--z-bg-sidebar))",
  },
});

/**
 * Button title
 */
const ButtonTitle = styled("div", {
  base: {
    gap: "var(--gap-md)",
    height: "100%",
    display: "flex",
    alignItems: "center",
  },
});

const PendingBadge = styled("div", {
  base: {
    ...typography.raw({ class: "label", size: "small" }),
    padding: "2px 6px",
    color: "var(--z-on-mention-badge, #FFFFFF)",
    background: "var(--z-mention-badge, #C2337A)",
    borderRadius: "var(--z-shape-chip, 6px)",
  },
});

const Category = styled("div", {
  base: {
    display: "flex",
    paddingInline: "16px",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "16px",
    paddingBottom: "8px",

    ...typography.raw({ class: "label", size: "small" }),
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/**
 * Styles required to correctly display name and status
 */
const NameStatusStack = styled("div", {
  base: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
});

/**
 * Single conversation entry
 */
function Entry(
  props: {
    channel: Channel;
    active: boolean;
    isMobile: boolean;
    phone?: boolean;
  } /*& Omit<
    ComponentProps<typeof Link>,
    "href"
  >*/,
) {
  const [local, remote] = splitProps(props, [
    "channel",
    "active",
    "isMobile",
    "phone",
  ]);

  const { t } = useLingui();
  const dayjs = useTime();
  const client = useClient();

  /** phones: when the last message came, short (time today, else the day) */
  const when = createMemo(() => {
    const at = local.channel.lastMessageAt;
    if (!local.phone || !at) return undefined;
    const then = dayjs(at);
    const now = dayjs();
    if (then.isSame(now, "day")) return then.format("LT");
    if (then.isSame(now.subtract(1, "day"), "day")) return t`Yesterday`;
    if (now.diff(then, "day") < 7) return then.format("dddd");
    return then.format("L");
  });

  /**
   * phones: the last message in one line, when this device has it (messages
   * are kept only for conversations that were opened or got a new message)
   */
  const preview = createMemo(() => {
    if (!local.phone) return undefined;
    const message = local.channel.lastMessage;
    if (!message || message.systemMessage) return undefined;
    const text =
      message.contentPlain?.trim() ||
      (message.attachments?.length ? t`Sent an attachment` : "");
    if (!text) return undefined;
    return message.author?.id === client().user?.id ? t`You: ${text}` : text;
  });

  /**
   * Determine user status if present
   */
  const status = createMemo(() =>
    statusLine(
      local.channel.recipient?.statusEmoji,
      local.channel.recipient?.statusMessage((s) =>
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

  return (
    <MenuButton
      {...remote}
      href={`/channel/${local.channel.id}`}
      size="normal"
      class={local.phone ? phoneEntry : undefined}
      alert={
        !local.active &&
        local.channel.unread &&
        (local.channel.mentions?.size || true)
      }
      attention={
        local.active
          ? "selected"
          : local.channel.muted
            ? "muted"
            : local.channel.unread
              ? "active"
              : "normal"
      }
      icon={
        <Switch>
          <Match when={local.channel.type === "Group"}>
            <Avatar
              size={32}
              shape="rounded-square"
              fallback={local.channel.name}
              src={local.channel.iconURL}
              primaryContrast
            />
          </Match>
          <Match when={local.channel.type === "DirectMessage"}>
            <AvatarDecoration
              decoration={local.channel.recipient?.style?.decoration}
              file={local.channel.recipient?.style?.decoration_file}
              size={32}
            >
              {/* official accounts are the system, not people: no online dot */}
              <Show
                when={!isOfficialChannel(local.channel)}
                fallback={<Avatar size={32} src={local.channel.iconURL} />}
              >
                <Avatar
                  size={32}
                  src={local.channel.iconURL}
                  holepunch="bottom-right"
                  overlay={
                    <UserStatus.Graphic
                      status={local.channel?.recipient?.presence}
                    />
                  }
                />
              </Show>
            </AvatarDecoration>
          </Match>
        </Switch>
      }
      use:floating={{
        contextMenu: () =>
          local.channel.type === "DirectMessage" ? (
            <UserContextMenu
              user={local.channel.recipient!}
              channel={local.channel}
            />
          ) : (
            <ChannelContextMenu channel={local.channel} />
          ),
      }}
    >
      <NameStatusStack>
        <Switch>
          <Match when={local.channel.type === "Group"}>
            <OverflowingText>
              <TextWithEmoji content={local.channel.name!} />
            </OverflowingText>
            <span class={typography({ class: "_status" })}>
              <Plural
                value={local.channel.recipientIds.size}
                one="# member"
                other="# members"
              />
            </span>
          </Match>
          <Match when={local.channel.type === "DirectMessage"}>
            <OverflowingText>
              <span style={nameStyle(local.channel?.recipient?.style)}>
                {local.channel?.recipient?.displayName}
              </span>
              <Show when={isOfficialChannel(local.channel)}>
                {" "}
                <OfficialLabel />
              </Show>
            </OverflowingText>
            <Show when={preview()}>
              <OverflowingText class={typography({ class: "_status" })}>
                <TextWithEmoji content={preview()!} />
              </OverflowingText>
            </Show>
            <Show when={!preview() && status()}>
              <Tooltip
                content={() => <TextWithEmoji content={status()!} />}
                placement="top-start"
                aria={status()!}
              >
                <OverflowingText class={typography({ class: "_status" })}>
                  <TextWithEmoji content={status()!} />
                </OverflowingText>
              </Tooltip>
            </Show>
          </Match>
        </Switch>
      </NameStatusStack>
      <Show when={when()}>
        <When>{when()}</When>
      </Show>
    </MenuButton>
  );
}

/** phones: taller rows, with room for the last message under the name */
const phoneEntry = css({
  position: "relative",
  minHeight: "58px",
  // room for the time at the end of the first line
  paddingInlineEnd: "76px",
});

/** phones: Home, Friends, Designs, notes and the studio in one row */
const Chips = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    padding: "8px 16px 4px",
    overflowX: "auto",
    scrollbarWidth: "none",
    flex: "none",
  },
});

const Chip = styled(A, {
  base: {
    flex: "none",
    height: "36px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    paddingInline: "12px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-subtle)",
    "--z-icon-color": "currentColor",
    "&[aria-current='page']": {
      color: "var(--z-fg-primary)",
      borderColor: "var(--z-accent)",
    },
    _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

/** When the last message came; at the end of the row, beside the name */
const When = styled("time", {
  base: {
    position: "absolute",
    insetInlineEnd: "12px",
    top: "10px",
    fontSize: "12px",
    fontWeight: 400,
    color: "var(--z-fg-muted)",
    whiteSpace: "nowrap",
  },
});

/** phones: search and add a friend, above the conversations */
const PhoneTools = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    padding: "12px 16px 4px",
  },
});

const SearchField = styled("label", {
  base: {
    flex: 1,
    minWidth: 0,
    height: "44px",
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
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    "--z-icon-color": "currentColor",
    _focusVisible: { outline: "none", boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

/** phones: online friends side by side; swipes sideways when they do not fit */
const OnlineRow = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    paddingInline: "16px",
    paddingBottom: "4px",
    overflowX: "auto",
    scrollbarWidth: "none",
    flex: "none",
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

/**
 * Inner scrollable list
 * We fix the width in order to prevent scrollbar from moving stuff around
 */
const List = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const EmptyConversations = styled("p", {
  base: {
    fontSize: "12px",
    lineHeight: 1.7,
    color: "var(--z-fg-muted)",
    padding: "4px 18px",
    margin: 0,
  },
});
