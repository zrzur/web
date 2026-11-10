import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Match, Show, Switch, createMemo, splitProps } from "solid-js";

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
  const { isMobile } = useDevice();

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
          <Show when={!props.conversations().length}>
            <EmptyConversations>
              <Trans>
                Your conversations will appear here. Start a group or find a
                friend to begin.
              </Trans>
            </EmptyConversations>
          </Show>

          <Deferred>
            <VirtualContainer
              items={props.conversations()}
              scrollTarget={scrollTargetElement}
              itemSize={{ height: 48 }}
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
  props: { channel: Channel; active: boolean; isMobile: boolean } /*& Omit<
    ComponentProps<typeof Link>,
    "href"
  >*/,
) {
  const [local, remote] = splitProps(props, ["channel", "active", "isMobile"]);

  const { t } = useLingui();

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
            <Show when={status()}>
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
    </MenuButton>
  );
}

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
