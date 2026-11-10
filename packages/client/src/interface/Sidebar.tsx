import {
  Component,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { styled } from "styled-system/jsx";

import { Channel, Server as ServerI } from "@zrzur/sdk/solid";

import {
  CategoryContextMenu,
  ChannelContextMenu,
  ServerSidebarContextMenu,
} from "@revolt/app";
import { useClient, useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useLocation, useParams, useSmartParams } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";

import { HomeSidebar, ServerList, ServerSidebar } from "./navigation";
import { MentionsHost } from "./navigation/MentionsPanel";
import { PhoneTabs } from "./navigation/PhoneTabs";
import { AccountBar } from "./navigation/channels/AccountBar";

const MainBar = styled("div", {
  base: {
    // anchors the floating account panel
    position: "relative",
    display: "flex",
    flexShrink: 0,

    // keep the last servers / channels clear of the account panel
    "& > *:not([data-account-panel])": {
      paddingBottom:
        "calc(var(--z-dock-height, 56px) + 2 * var(--z-dock-gap, 8px) + var(--z-voice-panel-space, 0px))",
    },

    _phone: {
      "--layout-width-channel-sidebar": "auto",
      position: "absolute",
      width: "100vw",
      height: "100%",

      // the tab bar takes the bottom edge; the account card only stays
      // for its call controls, just above the tabs (#root already stops
      // above the home bar, so no safe-area inset here)
      "& > *:not([data-account-panel]):not([data-phone-tabs])": {
        paddingBottom: "calc(62px + var(--z-voice-panel-space, 0px))",
      },
      "& > [data-account-panel]": {
        bottom: "70px",
      },
      "& > [data-account-panel]:not([data-in-call='true'])": {
        display: "none",
      },
      // typing (search, a text field): the keyboard needs the room, as in
      // native apps the tabs step aside until it closes
      "&:has(input:focus, textarea:focus, [contenteditable='true']:focus) > [data-phone-tabs]":
        { display: "none" },
    },
  },
});

/**
 * Left-most channel navigation sidebar
 */
export const Sidebar = (props: {
  /**
   * Menu generator TODO FIXME: remove
   */
  menuGenerator: (t: ServerI | Channel) => JSX.Directives["floating"];
}) => {
  const user = useUser();
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();

  const voice = useVoice();
  const params = useParams<{ server: string }>();
  const location = useLocation();

  // full pages (Discover, Designs, Developer Portal) bring their own
  // section sidebar
  const fullPage = () =>
    location.pathname.startsWith("/discover") ||
    location.pathname.startsWith("/designs") ||
    location.pathname.startsWith("/developers");

  // full pages hide their own menu below 900px: the account card then has
  // nothing to sit over and shrinks to the avatar on the rail
  const query = window.matchMedia("(max-width: 899px)");
  const [narrow, setNarrow] = createSignal(query.matches);
  const onChange = () => setNarrow(query.matches);
  query.addEventListener("change", onChange);
  onCleanup(() => query.removeEventListener("change", onChange));

  // the Developer Portal and Designs have no menu column for the card to
  // sit over
  const compact = () =>
    !state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) ||
    (fullPage() && narrow()) ||
    location.pathname.startsWith("/developers") ||
    location.pathname.startsWith("/designs") ||
    location.pathname.startsWith("/discover");

  return (
    <MainBar
      class="main_bar"
      style={{
        // room for the voice section the account card grows by in a call
        "--z-voice-panel-space": voice.channel() && !compact() ? "96px" : "0px",
      }}
    >
      <ServerList
        orderedServers={state.ordering.orderedServers(client())}
        orderedEntries={state.ordering.orderedEntries(client())}
        setServerOrder={state.ordering.setServerOrder}
        unreadConversations={state.ordering
          .orderedConversations(client())
          .filter(
            // TODO: muting channels
            (channel) => channel.unread,
          )}
        user={user()!}
        selectedServer={() => params.server}
        onCreateOrJoinServer={() =>
          openModal({
            type: "create_or_join_server",
            client: client(),
          })
        }
        menuGenerator={props.menuGenerator}
      />
      <Show
        when={
          state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) &&
          !fullPage()
        }
      >
        <Switch fallback={<Home />}>
          <Match when={params.server}>
            <Server />
          </Match>
        </Switch>
      </Show>
      {/* floats across the rail and the channel list (see AccountBar) */}
      <AccountBar compact={compact()} overPage={fullPage() && !narrow()} />
      <PhoneTabs />
      <MentionsHost />
    </MainBar>
  );
};

/**
 * Render sidebar for home
 */
const Home: Component = () => {
  const params = useSmartParams();
  const client = useClient();
  const state = useState();
  const conversations = createMemo(() =>
    state.ordering.orderedConversations(client()),
  );

  return (
    <HomeSidebar
      conversations={conversations}
      channelId={params().channelId}
      openSavedNotes={(navigate) => {
        // Check whether the saved messages channel exists already
        const channelId = [...client()!.channels.values()].find(
          (channel) => channel.type === "SavedMessages",
        )?.id;

        if (navigate) {
          if (channelId) {
            // Navigate if exists
            navigate(`/channel/${channelId}`);
          } else {
            // If not, try to create one but only if navigating
            client()!
              .user!.openDM()
              .then((channel) => navigate(`/channel/${channel.id}`));
          }
        }

        // Otherwise return channel ID if available
        return channelId;
      }}
    />
  );
};

/**
 * Render sidebar for a server
 */
const Server: Component = () => {
  const { openModal } = useModals();
  const params = useSmartParams();
  const client = useClient();

  /**
   * Resolve the server
   * @returns Server
   */
  const server = () => client()!.servers.get(params().serverId!)!;

  /**
   * Open the server information modal
   */
  function openServerInfo() {
    openModal({
      type: "server_info",
      server: server(),
    });
  }

  /**
   * Open the server settings modal
   */
  function openServerSettings() {
    openModal({
      type: "settings",
      config: "server",
      context: server(),
    });
  }

  return (
    <Show when={server()}>
      <ServerSidebar
        server={server()}
        channelId={params().channelId}
        openServerInfo={openServerInfo}
        openServerSettings={openServerSettings}
        menuGenerator={(target) =>
          // the sidebar background only offers "create", so no menu without it
          target instanceof ServerI && !target.havePermission("ManageChannel")
            ? {}
            : {
                contextMenu: () =>
                  target instanceof Channel ? (
                    <ChannelContextMenu channel={target} />
                  ) : target instanceof ServerI ? (
                    <ServerSidebarContextMenu server={target} />
                  ) : (
                    <CategoryContextMenu server={server()} category={target} />
                  ),
              }
        }
      />
    </Show>
  );
};
