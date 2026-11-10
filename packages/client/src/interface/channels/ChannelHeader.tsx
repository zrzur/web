import { Accessor, Match, Setter, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useNavigate } from "@revolt/routing";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import {
  IconButton,
  NonBreakingText,
  OverflowingText,
  Spacer,
  UserStatus,
} from "@revolt/ui";
import { OfficialLabel } from "@revolt/ui/components/features/profiles/OfficialLabel";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { Icon } from "@revolt/ui/icons/Icon";
import { RulesIcon } from "@revolt/ui/icons/RulesIcon";

import {
  cancelSelection,
  isSelecting,
  startSelection,
} from "@revolt/app/interface/channels/text/messageSelection";
import { writeAccess } from "@revolt/app/interface/channels/threadAccess";
import { isOfficialChannel } from "@revolt/app/interface/support/official";
import { ContextMenu, ContextMenuButton } from "@revolt/app/menus/ContextMenu";

import { HeaderIcon } from "../common/CommonHeader";

import { SearchBox } from "./text/SearchBox";
import { canIHasSidebar, SidebarState } from "./text/TextChannel";

interface Props {
  /**
   * Channel to render header for
   */
  channel: Channel;

  /**
   * Sidebar state
   */
  sidebarState?: Accessor<SidebarState>;

  /**
   * Set sidebar state
   */
  setSidebarState?: Setter<SidebarState>;
}

/**
 * Common channel header component
 */
export function ChannelHeader(props: Props) {
  const { openModal, showError } = useModals();
  const navigate = useNavigate();
  const client = useClient();
  const { t } = useLingui();
  const state = useState();
  const voice = useVoice();
  const { layout } = useDevice();
  const phone = () => layout() === "phone";

  /** anyone who can manage messages, or the owner of a thread still open */
  const canManageThread = () =>
    props.channel.havePermission("ManageMessages") ||
    (props.channel.thread?.ownerId === client().user?.id &&
      writeAccess(props.channel) === "allowed");

  const canOpenSettings = () =>
    (props.channel.type === "Group" || !!props.channel.serverId) &&
    props.channel.orPermission("ManageChannel", "ManagePermissions");
  const canListThreads = () =>
    !!props.sidebarState &&
    props.channel.type === "TextChannel" &&
    !props.channel.isVoice &&
    !props.channel.isThread &&
    !props.channel.isForum;
  /** moderators can select messages to delete them together */
  const canSelectMessages = () =>
    !!props.sidebarState &&
    props.channel.type === "TextChannel" &&
    props.channel.havePermission("ManageMessages");

  const toggleSelecting = () =>
    isSelecting(props.channel.id)
      ? cancelSelection()
      : startSelection(props.channel.id);

  const hasMoreActions = () =>
    canSelectMessages() ||
    canOpenSettings() ||
    canListThreads() ||
    !!props.sidebarState ||
    props.channel.type === "Group" ||
    !!props.channel.thread;

  const searchValue = () => {
    if (!props.sidebarState) return null;

    const state = props.sidebarState();
    if (state.state === "search") return state.query;
    return "";
  };

  // phones: search takes the whole header, as a search screen with a way
  // back; the keyboard opens on it right away
  const phoneSearch = () =>
    layout() === "phone" && props.sidebarState?.().state === "search";

  const phoneSearchBar = () => (
    <>
      <PhoneBack
        type="button"
        aria-label={t`Close search`}
        onClick={() => props.setSidebarState!({ state: "default" })}
      >
        <Icon name="arrow-left" size={22} />
      </PhoneBack>
      <SearchBox
        channel={props.channel}
        phone
        autofocus
        placeholder={t`Search messages`}
        value={searchValue() ?? ""}
        onCommit={(query) => props.setSidebarState!({ state: "search", query })}
        onClear={() => props.setSidebarState!({ state: "search", query: "" })}
      />
    </>
  );

  return (
    <Show when={!phoneSearch()} fallback={phoneSearchBar()}>
      <>
        <Switch>
          <Match
            when={
              props.channel.type === "TextChannel" ||
              props.channel.type === "Group"
            }
          >
            <HeaderIcon>
              {/* Same type glyphs as the channel list: rules / announce / voice / # */}
              <Switch fallback={<Icon name="hash" size={22} />}>
                <Match
                  when={
                    props.channel.type === "TextChannel" &&
                    props.channel.isThread
                  }
                >
                  <Icon name="chat-circle" size={22} />
                </Match>
                <Match
                  when={
                    props.channel.type === "TextChannel" &&
                    props.channel.isForum
                  }
                >
                  <Icon name="note-pencil" size={22} />
                </Match>
                <Match
                  when={
                    props.channel.type === "TextChannel" &&
                    props.channel.server?.rulesChannelId === props.channel.id
                  }
                >
                  <RulesIcon size={22} />
                </Match>
                <Match
                  when={
                    props.channel.type === "TextChannel" &&
                    props.channel.announcement
                  }
                >
                  <Icon name="megaphone" size={22} />
                </Match>
                <Match
                  when={
                    props.channel.type === "TextChannel" &&
                    props.channel.isVoice
                  }
                >
                  <Icon
                    name={props.channel.isStage ? "waveform" : "speaker-high"}
                    size={22}
                  />
                </Match>
              </Switch>
            </HeaderIcon>
            <Show when={props.channel.parent}>
              {(parent) => (
                <>
                  <ParentLink
                    type="button"
                    onClick={() =>
                      navigate(
                        `/server/${parent().serverId}/channel/${parent().id}`,
                      )
                    }
                  >
                    <TextWithEmoji content={parent().name!} />
                  </ParentLink>
                  <Separator aria-hidden="true">â€º</Separator>
                </>
              )}
            </Show>
            <NonBreakingText
              class={channelTitle + " " + mobileOverflow}
              onClick={() =>
                openModal({
                  type: "channel_info",
                  channel: props.channel,
                })
              }
            >
              <TextWithEmoji content={props.channel.name!} />
            </NonBreakingText>
            <Show when={layout() !== "phone" && props.channel.description}>
              <Divider />
              <a
                class={descriptionLink}
                onClick={() =>
                  openModal({
                    type: "channel_info",
                    channel: props.channel,
                  })
                }
                use:floating={{
                  tooltip: {
                    placement: "bottom",
                    content: t`Click to show full description`,
                  },
                }}
              >
                <OverflowingText class={channelTopic}>
                  <TextWithEmoji
                    content={props.channel.description?.split("\n").shift()}
                  />
                </OverflowingText>
              </a>
            </Show>
          </Match>
          <Match when={props.channel.type === "DirectMessage"}>
            <HeaderIcon>
              <Symbol type="outlined">alternate_email</Symbol>
            </HeaderIcon>
            <OverflowingText>
              <TextWithEmoji
                content={
                  props.channel.recipient?.displayName ??
                  props.channel.recipient?.username
                }
              />
            </OverflowingText>
            <Show
              when={isOfficialChannel(props.channel)}
              fallback={
                <UserStatus
                  status={props.channel.recipient?.presence}
                  size="8px"
                />
              }
            >
              <OfficialLabel />
            </Show>
          </Match>
          <Match when={props.channel.type === "SavedMessages"}>
            <HeaderIcon>
              <Symbol type="outlined">note_stack</Symbol>
            </HeaderIcon>
            <Trans>Saved notes</Trans>
          </Match>
        </Switch>

        <Spacer />

        <Show when={props.channel.isVoice && !voice.showCard(props.channel)}>
          <IconButton
            variant="toolbar"
            size="xs"
            onPress={() => voice.connect(props.channel)}
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: t`Join the voice channel`,
              },
            }}
          >
            <Symbol type="outlined" size={20}>
              call
            </Symbol>
          </IconButton>
        </Show>

        <Show
          when={
            !phone() &&
            (props.channel.type === "Group" || props.channel.serverId) &&
            props.channel.orPermission("ManageChannel", "ManagePermissions")
          }
        >
          <IconButton
            variant="toolbar"
            size="xs"
            onPress={() =>
              openModal({
                type: "settings",
                config: "channel",
                context: props.channel,
              })
            }
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: t`Channel settings`,
              },
            }}
          >
            <Symbol type="outlined" size={20}>
              settings
            </Symbol>
          </IconButton>
        </Show>

        <Show when={!phone() && props.channel.type === "Group"}>
          <IconButton
            variant="toolbar"
            size="xs"
            onPress={() =>
              openModal({
                type: "add_members_to_group",
                group: props.channel,
                client: client(),
              })
            }
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: t`Add friends to group`,
              },
            }}
          >
            <Symbol type="outlined" size={20}>
              person_add
            </Symbol>
          </IconButton>
        </Show>

        <Show when={!phone() && props.channel.thread && canManageThread()}>
          <IconButton
            variant="toolbar"
            size="xs"
            aria-label={
              props.channel.thread?.archived
                ? t`Reopen thread`
                : t`Archive thread`
            }
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: props.channel.thread?.archived
                  ? t`Reopen thread`
                  : t`Archive thread`,
              },
            }}
            onPress={() =>
              void props.channel
                .editThread({ archived: !props.channel.thread?.archived })
                .catch(showError)
            }
          >
            <Icon
              name={
                props.channel.thread?.archived
                  ? "arrow-counter-clockwise"
                  : "archive"
              }
              size={20}
            />
          </IconButton>
        </Show>

        <Show
          when={
            !phone() &&
            props.channel.thread &&
            props.channel.havePermission("ManageMessages")
          }
        >
          <IconButton
            variant="toolbar"
            size="xs"
            aria-pressed={!!props.channel.thread?.locked}
            aria-label={
              props.channel.thread?.locked ? t`Unlock thread` : t`Lock thread`
            }
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: props.channel.thread?.locked
                  ? t`Unlock thread`
                  : t`Lock thread: only moderators can write`,
              },
            }}
            onPress={() =>
              void props.channel
                .editThread({ locked: !props.channel.thread?.locked })
                .catch(showError)
            }
          >
            <Icon
              name={
                props.channel.thread?.locked
                  ? "lock-simple"
                  : "lock-simple-open"
              }
              size={20}
            />
          </IconButton>
        </Show>

        <Show when={!phone() && canListThreads()}>
          <IconButton
            variant="toolbar"
            size="xs"
            aria-pressed={props.sidebarState!().state === "threads"}
            aria-label={t`Threads`}
            use:floating={{
              tooltip: { placement: "bottom", content: t`Threads` },
            }}
            onPress={() =>
              props.sidebarState!().state === "threads"
                ? props.setSidebarState!({ state: "default" })
                : props.setSidebarState!({ state: "threads" })
            }
          >
            <Icon name="chat-circle" size={20} />
          </IconButton>
        </Show>

        <Show when={!phone() && props.sidebarState}>
          <IconButton
            variant="toolbar"
            size="xs"
            aria-pressed={props.sidebarState!().state === "pins"}
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: t`Pinned messages`,
              },
            }}
            onPress={() =>
              props.sidebarState!().state === "pins"
                ? props.setSidebarState!({
                    state: "default",
                  })
                : props.setSidebarState!({
                    state: "pins",
                  })
            }
          >
            <Symbol type="outlined" size={20}>
              push_pin
            </Symbol>
          </IconButton>
        </Show>

        <Show when={props.sidebarState && canIHasSidebar(props.channel)}>
          <IconButton
            variant="toolbar"
            size="xs"
            aria-label={t`Member list`}
            aria-pressed={
              layout() === "desktop"
                ? props.sidebarState!().state === "default" &&
                  state.layout.getSectionState(
                    LAYOUT_SECTIONS.MEMBER_SIDEBAR,
                    true,
                  )
                : props.sidebarState!().state === "members"
            }
            onPress={() => {
              // narrow layouts: the member list is an on-demand overlay
              if (layout() !== "desktop") {
                props.setSidebarState!({
                  state:
                    props.sidebarState!().state === "members"
                      ? "default"
                      : "members",
                });
              } else if (props.sidebarState!().state === "default") {
                state.layout.toggleSectionState(
                  LAYOUT_SECTIONS.MEMBER_SIDEBAR,
                  true,
                );
              } else {
                state.layout.setSectionState(
                  LAYOUT_SECTIONS.MEMBER_SIDEBAR,
                  true,
                  true,
                );

                props.setSidebarState!({
                  state: "default",
                });
              }
            }}
            use:floating={{
              tooltip: {
                placement: "bottom",
                content: t`Member list`,
              },
            }}
          >
            <Symbol type="outlined" size={20}>
              group
            </Symbol>
          </IconButton>
        </Show>

        <Show when={searchValue() !== null}>
          <Show
            when={
              layout() === "desktop" || props.sidebarState!().state === "search"
            }
            fallback={
              <IconButton
                variant="toolbar"
                size="xs"
                onPress={() =>
                  props.setSidebarState!({ state: "search", query: "" })
                }
                use:floating={{
                  tooltip: {
                    placement: "bottom",
                    content: t`Search`,
                  },
                }}
              >
                <Symbol type="outlined" size={20}>
                  search
                </Symbol>
              </IconButton>
            }
          >
            <SearchBox
              channel={props.channel}
              placeholder={t`Search`}
              value={searchValue()!}
              onCommit={(query) =>
                props.setSidebarState!({ state: "search", query })
              }
              onClear={() => props.setSidebarState!({ state: "default" })}
            />
          </Show>
        </Show>

        {/* the less-used actions share one "More" menu: on phones all of
            them, so the channel name keeps the room it needs; on desktop
            only selecting messages, a moderator tool that is rarely needed */}
        <Show
          when={
            phone() ? !phoneSearch() && hasMoreActions() : canSelectMessages()
          }
        >
          <div
            style={{ display: "contents" }}
            use:floating={{
              contextMenu: () => (
                <ContextMenu>
                  <Show when={canSelectMessages()}>
                    <ContextMenuButton
                      icon={<Icon name="check-square" size={20} />}
                      onClick={toggleSelecting}
                      data-testid="select-messages"
                    >
                      {isSelecting(props.channel.id)
                        ? t`Stop selecting messages`
                        : t`Select messages`}
                    </ContextMenuButton>
                  </Show>
                  <Show when={phone() && canOpenSettings()}>
                    <ContextMenuButton
                      icon={<Icon name="gear-six" size={20} />}
                      onClick={() =>
                        openModal({
                          type: "settings",
                          config: "channel",
                          context: props.channel,
                        })
                      }
                    >
                      {t`Channel settings`}
                    </ContextMenuButton>
                  </Show>
                  <Show when={phone() && canListThreads()}>
                    <ContextMenuButton
                      icon={<Icon name="chat-circle" size={20} />}
                      onClick={() =>
                        props.setSidebarState!({ state: "threads" })
                      }
                    >
                      {t`Threads`}
                    </ContextMenuButton>
                  </Show>
                  <Show when={phone() && props.sidebarState}>
                    <ContextMenuButton
                      icon={<Icon name="push-pin" size={20} />}
                      onClick={() => props.setSidebarState!({ state: "pins" })}
                    >
                      {t`Pinned messages`}
                    </ContextMenuButton>
                  </Show>
                  <Show when={phone() && props.channel.type === "Group"}>
                    <ContextMenuButton
                      icon={<Icon name="user-plus" size={20} />}
                      onClick={() =>
                        openModal({
                          type: "add_members_to_group",
                          group: props.channel,
                          client: client(),
                        })
                      }
                    >
                      {t`Add friends to group`}
                    </ContextMenuButton>
                  </Show>
                  <Show
                    when={phone() && props.channel.thread && canManageThread()}
                  >
                    <ContextMenuButton
                      icon={<Icon name="archive" size={20} />}
                      onClick={() =>
                        void props.channel
                          .editThread({
                            archived: !props.channel.thread?.archived,
                          })
                          .catch(showError)
                      }
                    >
                      {props.channel.thread?.archived
                        ? t`Reopen thread`
                        : t`Archive thread`}
                    </ContextMenuButton>
                  </Show>
                  <Show
                    when={
                      phone() &&
                      props.channel.thread &&
                      props.channel.havePermission("ManageMessages")
                    }
                  >
                    <ContextMenuButton
                      icon={<Icon name="lock-simple" size={20} />}
                      onClick={() =>
                        void props.channel
                          .editThread({ locked: !props.channel.thread?.locked })
                          .catch(showError)
                      }
                    >
                      {props.channel.thread?.locked
                        ? t`Unlock thread`
                        : t`Lock thread`}
                    </ContextMenuButton>
                  </Show>
                </ContextMenu>
              ),
              contextMenuHandler: "click",
            }}
          >
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`More`}
              aria-haspopup="menu"
            >
              <Icon name="dots-three" size={20} />
            </IconButton>
          </div>
        </Show>
      </>
    </Show>
  );
}

/** Phone search: back to the channel */
const PhoneBack = styled("button", {
  base: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    display: "grid",
    placeItems: "center",
    marginInlineStart: "-6px",
    border: "none",
    borderRadius: "50%",
    background: "none",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    "& .z-icon": { _rtl: { transform: "scaleX(-1)" } },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

/**
 * Vertical divider between name and topic
 */
/** A thread's channel, before the thread's name */
const ParentLink = styled("button", {
  base: {
    border: "none",
    background: "transparent",
    padding: "4px 6px",
    borderRadius: "var(--z-radius-sm)",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    maxWidth: "30%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    _hover: { color: "var(--z-fg-primary)", background: "var(--z-bg-raised)" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
  },
});

const Separator = styled("span", {
  base: {
    color: "var(--z-fg-muted, var(--z-fg-secondary))",
    paddingInline: "2px",
    _rtl: { transform: "scaleX(-1)" },
  },
});

const Divider = styled("div", {
  base: {
    height: "20px",
    width: "1px",
    flexShrink: 0,
    margin: "0 4px",
    backgroundColor: "var(--z-border-strong)",
  },
});

/**
 * Link for the description
 */
const descriptionLink = css({
  minWidth: 0,
  cursor: "pointer",
});

const channelTitle = css({
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: "20px",
  color: "var(--z-fg-primary)",
  cursor: "pointer",
});

const channelTopic = css({
  fontSize: "14px",
  fontWeight: 400,
  color: "var(--z-fg-muted)",
  "&:hover": { color: "var(--z-fg-secondary)" },
});

const mobileOverflow = css({
  _phone: {
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});
