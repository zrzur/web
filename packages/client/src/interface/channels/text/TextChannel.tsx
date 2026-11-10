import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  lazy,
  on,
  onCleanup,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime, ulid } from "ulid";

import { DraftMessages, Messages } from "@revolt/app";
import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { Keybind, KeybindAction, createKeybind } from "@revolt/keybinds";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import {
  BelowFloatingHeader,
  Header,
  NewMessages,
  Text,
  main,
} from "@revolt/ui";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";
import { MotionPresence } from "@revolt/ui/motion";

import { isOfficialChannel } from "@revolt/app/interface/support/official";
import { OfficialBanner } from "@revolt/app/interface/support/OfficialBanner";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import {
  EphemeralMessages,
  InteractionModal,
  attachInteractions,
} from "@revolt/app/interface/channels/text/interactions";
import { Channel } from "@zrzur/sdk/solid";

import { isSelecting } from "@revolt/app/interface/channels/text/messageSelection";

import { writeAccess } from "@revolt/app/interface/channels/threadAccess";
import { MessageComposition } from "./Composition";
import { isLargeServer } from "./largeServer";
import { MemberSidebar } from "./MemberSidebar";
import { TextSearchSidebar } from "./TextSearchSidebar";

import { ThreadsPanel } from "./ThreadsPanel";

// Shown only while a moderator selects messages: loads on first use.
const MessageSelectionBar = lazy(() =>
  import("@revolt/app/interface/channels/text/MessageSelectionBar").then(
    (m) => ({ default: m.MessageSelectionBar }),
  ),
);

/**
 * State of the channel sidebar
 */
export type SidebarState =
  | {
      state: "search";
      query: string;
    }
  | {
      state: "pins";
    }
  | {
      /** Threads of this channel */
      state: "threads";
    }
  | {
      /**
       * Member list opened on demand (narrow layouts, where it overlays the chat)
       */
      state: "members";
    }
  | {
      state: "default";
    };

export function canIHasSidebar(ch: Channel) {
  return !["SavedMessages", "DirectMessage"].includes(ch.type);
}

/**
 * Channel component
 */
export function TextChannel(props: ChannelPageProps) {
  const state = useState();
  const client = useClient();
  const { layout } = useDevice();

  // bot interactions: private answers, forms and progress for this user
  attachInteractions(client());

  // below the desktop breakpoint side panels overlay the chat instead of squeezing it
  const overlaySidebar = () => layout() !== "desktop";

  // Last unread message id
  const [lastId, setLastId] = createSignal<string>();

  // Read highlighted message id from parameters
  const params = useSmartParams();
  const navigate = useNavigate();

  /**
   * Message id to be highlighted
   * @returns Message Id
   */
  const highlightMessageId = () => params().messageId;

  const canConnect = () =>
    props.channel.isVoice && props.channel.havePermission("Connect");

  // Get a reference to the message box's load latest function
  let jumpToBottomRef: ((nearby?: string) => void) | undefined;

  const [atEnd, setEnd] = createSignal(true);

  // Store last unread message id. Unread state arrives after the first
  // render, so this runs again when it is loaded (before the ack effect below)
  createEffect(
    on(
      () => [props.channel.id, client().channelUnreads.loaded] as const,
      ([id]) =>
        setLastId(
          props.channel.unread
            ? (client().channelUnreads.get(id)?.lastMessageId as string)
            : undefined,
        ),
    ),
  );

  // Mark channel as read whenever it is marked as unread
  createEffect(
    on(
      // must be at the end of the conversation
      () => props.channel.unread && atEnd(),
      (unread) => {
        if (unread) {
          if (document.hasFocus()) {
            // acknowledge the message
            props.channel.ack();
          } else {
            // otherwise mark this location as the last read location
            if (!lastId()) {
              // (taking away one second from the seed)
              setLastId(ulid(decodeTime(props.channel.lastMessageId!) - 1));
            }
          }
        }
      },
    ),
  );

  // When the newest message is your own (sent from this or another device,
  // or an older read mark the server kept), you have caught up: the
  // "new messages" bar and divider go
  createEffect(
    on(
      () => props.channel.lastMessage?.authorId,
      (authorId) => {
        if (authorId && authorId === client().user?.id && lastId()) {
          setLastId(undefined);
        }
      },
    ),
  );

  // Mark as read on re-focus
  function onFocus() {
    if (props.channel.unread && atEnd()) {
      props.channel.ack();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") onFocus();
  }

  // Chromium + webkit
  window.addEventListener("focus", onFocus);
  // Gecko
  document.addEventListener("focus", onFocus);
  // Mobile (eg. unlock screen)
  document.addEventListener("visibilitychange", onVisibilityChange);
  onCleanup(() => {
    // Mobile
    document.removeEventListener("visibilitychange", onVisibilityChange);
    // Gecko
    document.removeEventListener("focus", onFocus);
    // Chromium + webkit
    window.removeEventListener("focus", onFocus);
  });

  // Register ack/jump latest
  createKeybind(KeybindAction.CHAT_JUMP_END, () => {
    // Mark channel as read if not already
    if (props.channel.unread) {
      props.channel.ack();
    }

    // Clear the last unread id
    if (lastId()) {
      setLastId(undefined);
    }

    // Scroll to the bottom
    jumpToBottomRef?.();
  });

  // Sidebar scroll target
  let sidebarScrollTargetElement!: HTMLDivElement;

  // Sidebar state
  const [sidebarState, setSidebarState] = createSignal<SidebarState>({
    state: "default",
  });

  // todo: in the future maybe persist per ID?
  createEffect(
    on(
      () => props.channel.id,
      () => setSidebarState({ state: "default" }),
    ),
  );

  // If this is a server text channel, sync the members
  // todo: useQuery
  createEffect(
    on(
      () => props.channel.serverId,
      (serverId, prevServerId) =>
        // This effect tracks channel, not serverId, therefore we must ensure the old serverId
        // is not the same as the current serverId
        prevServerId !== serverId &&
        props.channel.type === "TextChannel" &&
        props.channel.server?.syncMembers(isLargeServer(props.channel.server)),
    ),
  );

  /** Whether this person may write here, when this is a thread */
  const threadBlock = () =>
    props.channel.isThread ? writeAccess(props.channel) : "allowed";

  return (
    <>
      <Header placement="primary">
        <ChannelHeader
          channel={props.channel}
          sidebarState={sidebarState}
          setSidebarState={setSidebarState}
        />
      </Header>
      <Content>
        <main class={main()}>
          <Show
            when={canConnect()}
            fallback={
              <BelowFloatingHeader>
                <div>
                  <NewMessages
                    lastId={lastId}
                    jumpBack={() => navigate(lastId()!)}
                    dismiss={() => setLastId()}
                  />
                </div>
              </BelowFloatingHeader>
            }
          >
            <VoiceChannelCallCardMount channel={props.channel} />
          </Show>

          <Messages
            channel={props.channel}
            lastReadId={lastId}
            pendingMessages={(pendingProps) => (
              <>
                <DraftMessages
                  channel={props.channel}
                  tail={pendingProps.tail}
                  sentIds={pendingProps.ids}
                />
                <EphemeralMessages
                  channelId={props.channel.id}
                  serverId={props.channel.serverId}
                />
              </>
            )}
            highlightedMessageId={highlightMessageId}
            clearHighlightedMessage={() => navigate(".")}
            jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
            atEnd={[atEnd, setEnd]}
          />

          <InteractionModal />

          {/* nobody writes to an official account; replies go to a ticket */}
          <Show
            when={
              props.channel.thread?.archived &&
              !props.channel.thread?.locked &&
              threadBlock() === "allowed"
            }
          >
            <ThreadNotice>
              <Trans>This thread is archived. A new message reopens it.</Trans>
            </ThreadNotice>
          </Show>
          <Show
            when={!isOfficialChannel(props.channel)}
            fallback={<OfficialBanner channel={props.channel} />}
          >
            <Show
              when={
                !props.channel.thread?.locked ||
                props.channel.havePermission("ManageMessages")
              }
              fallback={
                <ThreadNotice>
                  <Trans>
                    This thread is locked. Only moderators can write.
                  </Trans>
                </ThreadNotice>
              }
            >
              <Switch
                fallback={
                  <MessageComposition
                    channel={props.channel}
                    onMessageSend={() => jumpToBottomRef?.()}
                  />
                }
              >
                <Match when={isSelecting(props.channel.id)}>
                  <MessageSelectionBar channel={props.channel} />
                </Match>
                <Match
                  when={
                    threadBlock() === "switched-off" &&
                    props.channel.parent?.isForum
                  }
                >
                  <ThreadNotice>
                    <Trans>
                      Forums are off in this server. This post can only be read.
                    </Trans>
                  </ThreadNotice>
                </Match>
                <Match when={threadBlock() === "switched-off"}>
                  <ThreadNotice>
                    <Trans>
                      Threads are off in this server. This thread can only be
                      read.
                    </Trans>
                  </ThreadNotice>
                </Match>
                <Match when={threadBlock() === "no-permission"}>
                  <ThreadNotice>
                    <Trans>You can't write in this thread.</Trans>
                  </ThreadNotice>
                </Match>
              </Switch>
            </Show>
          </Show>
        </main>
        <MotionPresence
          area="panels"
          appear={false}
          when={
            (!overlaySidebar() &&
              state.layout.getSectionState(
                LAYOUT_SECTIONS.MEMBER_SIDEBAR,
                true,
              ) &&
              canIHasSidebar(props.channel)) ||
            sidebarState().state !== "default"
          }
        >
          <div
            ref={sidebarScrollTargetElement}
            use:scrollable={{
              direction: "y",
              showOnHover: true,
              class: sidebar({ overlay: overlaySidebar() }),
            }}
            style={{
              width:
                sidebarState().state === "search" ||
                sidebarState().state === "pins" ||
                sidebarState().state === "threads"
                  ? "var(--z-wide-sidebar, min(360px, 100%))"
                  : "",
            }}
          >
            <Switch
              fallback={
                <MemberSidebar
                  channel={props.channel}
                  scrollTargetElement={sidebarScrollTargetElement}
                  isLargeServer={isLargeServer(props.channel.server)}
                />
              }
            >
              <Match when={sidebarState().state === "search"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      <Trans>Search results</Trans>
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{
                      query: (sidebarState() as { query: string }).query,
                    }}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "threads"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      <Trans>Threads</Trans>
                    </Text>
                  </SidebarTitle>
                  <ThreadsPanel channel={props.channel} />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "pins"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      <Trans>Pinned messages</Trans>
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{ pinned: true, sort: "Latest" }}
                  />
                </WideSidebarContainer>
              </Match>
            </Switch>

            <Show when={sidebarState().state !== "default"}>
              <Keybind
                keybind={KeybindAction.CLOSE_SIDEBAR}
                onPressed={() => setSidebarState({ state: "default" })}
              />
            </Show>
          </div>
        </MotionPresence>
      </Content>
    </>
  );
}

/** Under the messages of an archived or locked thread */
const ThreadNotice = styled("div", {
  base: {
    margin: "0 16px 12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    textAlign: "center",
  },
});

/**
 * Main content row layout
 */
const Content = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
  },
});

/**
 * Base styles
 */
const sidebar = cva({
  base: {
    flexShrink: 0,
    width: "var(--z-member-width, var(--layout-width-member-sidebar, 240px))",
    borderRadius: 0,
    background: "var(--z-bg-shell)",
    borderInlineStart: "1px solid var(--z-border-subtle)",
  },
  variants: {
    overlay: {
      true: {
        position: "absolute",
        insetBlock: 0,
        insetInlineEnd: 0,
        zIndex: 20,
        maxWidth: "100%",
        boxShadow: "var(--z-popover-lift)",
        // phones: members, search results and pins take the whole screen
        _phone: { "--z-wide-sidebar": "100%", width: "100% !important" },
      },
      false: {},
    },
  },
});

/**
 * Container styles
 */
const WideSidebarContainer = styled("div", {
  base: {
    paddingRight: "var(--gap-md)",
    width: "360px",
    _phone: { width: "100%", paddingInline: "var(--gap-md)" },
  },
});

/**
 * Sidebar title
 */
const SidebarTitle = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});
