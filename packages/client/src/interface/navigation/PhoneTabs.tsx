import { Show, createEffect, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient, useUser } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@solidjs/router";

import { useLocation, useParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui";

import { type IconName, Icon } from "@revolt/ui/icons/Icon";
import { openMentions } from "./MentionsPanel";

/** the last server visited, so the Servers tab returns to it */
const [lastServer, setLastServer] = createSignal<string>();

/**
 * Phone navigation: a bar fixed to the bottom of the menu side with five
 * tabs, each with its name under the icon: Servers (rail + channels),
 * Messages, Discover, Mentions and You. The open tab's icon sits on a soft
 * pink tile and its name is full strength (the design the owner picked,
 * 2026-11-16).
 * Hidden on wider screens, where the rail and account card do this job.
 */
export function PhoneTabs() {
  const { t } = useLingui();
  const state = useState();
  const client = useClient();
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ server?: string }>();
  const { openModal } = useModals();

  createEffect(() => {
    if (params.server) setLastServer(params.server);
  });

  const active = () => {
    const path = location.pathname;
    if (path.startsWith("/server")) return "servers";
    if (path.startsWith("/discover")) return "discover";
    if (path.startsWith("/you")) return "you";
    return "messages";
  };

  const unreadMentions = () =>
    [...client().channels.values()].reduce(
      (sum, channel) => sum + (channel.mentions?.size ?? 0),
      0,
    );

  const unreadMessages = () =>
    state.ordering
      .orderedConversations(client())
      .filter((channel) => channel.unread).length;

  /** stay on the menu side: the list is what the tab is for */
  const openServers = () => {
    const id = lastServer() ?? state.ordering.orderedServers(client())[0]?.id;
    if (!id)
      return openModal({ type: "create_or_join_server", client: client() });
    if (params.server !== id)
      navigate(state.layout.getLastActiveServerPath(id));
  };

  const openMessages = () => {
    if (active() !== "messages") navigate("/app");
  };

  const openDiscover = () => {
    navigate(state.layout.getLastActiveDiscoverPath());
    // full pages live on the content side
    state.appDrawer()?.setShown(true);
  };

  const tab = (
    id: string,
    icon: IconName,
    label: string,
    onPress: () => void,
    badge?: () => number,
  ) => (
    <Tab
      type="button"
      aria-current={active() === id ? "page" : undefined}
      data-current={active() === id}
      onClick={onPress}
    >
      <TabIcon>
        <Icon name={icon} size={24} />
        <Show when={badge?.()}>
          <Badge data-tab-badge aria-label={t`${badge!()} unread`}>
            {badge!() > 99 ? "99+" : badge!()}
          </Badge>
        </Show>
      </TabIcon>
      <TabName>{label}</TabName>
    </Tab>
  );

  return (
    <Bar data-phone-tabs aria-label={t`Main navigation`}>
      {tab("servers", "squares-four", t`Servers`, openServers)}
      {tab("messages", "chat-circle-dots", t`Messages`, openMessages, () =>
        unreadMessages(),
      )}
      {tab("discover", "compass", t`Discover`, openDiscover)}
      {/* mentions open as a sheet over whatever is on screen */}
      <Tab type="button" aria-haspopup="dialog" onClick={openMentions}>
        <TabIcon>
          <Icon name="at" size={24} />
          <Show when={unreadMentions()}>
            <Badge data-tab-badge>
              {unreadMentions() > 99 ? "99+" : unreadMentions()}
            </Badge>
          </Show>
        </TabIcon>
        <TabName>{t`Mentions`}</TabName>
      </Tab>
      <Tab
        type="button"
        aria-current={active() === "you" ? "page" : undefined}
        data-current={active() === "you"}
        onClick={() => {
          navigate("/you");
          state.appDrawer()?.setShown(true);
        }}
      >
        <TabIcon>
          <Avatar
            size={26}
            src={user()?.animatedAvatarURL}
            fallback={user()?.username}
          />
        </TabIcon>
        <TabName>{t`You`}</TabName>
      </Tab>
    </Bar>
  );
}

const Bar = styled("nav", {
  base: {
    display: "none",
    _phone: {
      position: "absolute",
      zIndex: 3,
      insetInline: 0,
      bottom: 0,
      display: "grid",
      // five equal columns: a long name (German "Benachrichtigungen")
      // shortens inside its own column and never pushes its neighbours
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      // #root already stops above the home bar (styles.css), so no inset here
      height: "64px",
      paddingInline: "4px",
      background: "var(--z-bg-frame)",
      borderTop: "1px solid var(--z-border-subtle)",
    },
  },
});

const Tab = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    minWidth: 0,
    paddingInline: "2px",
    border: "none",
    background: "none",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    WebkitTapHighlightColor: "transparent",
    transition: "color 120ms ease",
    _motionReduce: { transition: "none" },

    "&:active > span:first-of-type": { scale: "0.94" },
    _active: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    // the open tab: full-strength name, the icon on a soft pink tile
    "&[data-current='true']": {
      color: "var(--z-fg-primary)",
      fontWeight: 600,
      "& > span:first-of-type": {
        background: "color-mix(in srgb, var(--z-accent) 18%, transparent)",
        "--z-icon-color": "var(--z-accent)",
        color: "var(--z-accent)",
      },
    },
  },
});

/** The tab's name; shortens inside its column */
const TabName = styled("span", {
  base: {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/** The icon's tile: the unread count reaches past it, so it is never cut */
const TabIcon = styled("span", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "52px",
    height: "30px",
    borderRadius: "15px",
  },
});

const Badge = styled("span", {
  base: {
    position: "absolute",
    top: "-4px",
    insetInlineStart: "58%",
    minWidth: "18px",
    height: "18px",
    paddingInline: "5px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--z-on-mention-badge, #FFFFFF)",
    background: "var(--z-mention-badge, #C2337A)",
    boxShadow: "0 0 0 2px var(--z-bg-frame)",
  },
});
