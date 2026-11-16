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
 * Phone navigation: a floating bar at the bottom of the menu side with five
 * tabs: Servers (rail + channels), Messages, Designs, Notifications and You.
 * The open tab is a filled capsule with its name; the others are icons with
 * the name for screen readers. Discover stays on the server rail.
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
    if (path.startsWith("/designs")) return "designs";
    // Discover is opened from the rail; no tab is its own
    if (path.startsWith("/discover")) return "none";
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

  const openDesigns = () => {
    navigate("/designs");
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
      aria-label={label}
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
      <Show when={active() === id}>
        <TabName aria-hidden="true">{label}</TabName>
      </Show>
    </Tab>
  );

  return (
    <Bar data-phone-tabs aria-label={t`Main navigation`}>
      {tab("servers", "squares-four", t`Servers`, openServers)}
      {tab("messages", "chat-circle-dots", t`Messages`, openMessages, () =>
        unreadMessages(),
      )}
      {tab("designs", "palette", t`Designs`, openDesigns)}
      {/* notifications open as a sheet over whatever is on screen */}
      <Tab
        type="button"
        aria-label={t`Notifications`}
        aria-haspopup="dialog"
        onClick={openMentions}
      >
        <TabIcon>
          <Icon name="bell" size={24} />
          <Show when={unreadMentions()}>
            <Badge data-tab-badge>
              {unreadMentions() > 99 ? "99+" : unreadMentions()}
            </Badge>
          </Show>
        </TabIcon>
      </Tab>
      <Tab
        type="button"
        aria-label={t`You`}
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
        <Show when={active() === "you"}>
          <TabName aria-hidden="true">{t`You`}</TabName>
        </Show>
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
      // a floating bar: clear of both sides and of the bottom edge
      // (#root already stops above the home bar, styles.css)
      insetInline: "12px",
      bottom: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "2px",
      height: "60px",
      paddingInline: "8px",
      borderRadius: "22px",
      background: "var(--z-bg-raised)",
      border: "1px solid var(--z-border-subtle)",
      boxShadow: "0 10px 28px rgb(0 0 0 / 0.38)",
    },
  },
});

const Tab = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    flex: "none",
    minWidth: "48px",
    height: "44px",
    paddingInline: "10px",
    border: "none",
    borderRadius: "16px",
    background: "none",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    WebkitTapHighlightColor: "transparent",
    transition: "color 120ms ease, background-color 120ms ease",
    _motionReduce: { transition: "none" },

    "&:active > span:first-of-type": { scale: "0.92" },
    _active: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "0 0 0 2px var(--z-focus)",
    },
    // the open tab: a filled capsule with its name
    "&[data-current='true']": {
      flex: "0 1 auto",
      minWidth: 0,
      paddingInline: "14px",
      color: "var(--z-on-accent, #FFFFFF)",
      background: "var(--z-accent)",
      "--z-icon-color": "var(--z-on-accent, #FFFFFF)",
      // on the filled capsule the count turns white so it stays readable
      "& [data-tab-badge]": {
        color: "var(--z-accent)",
        background: "var(--z-on-accent, #FFFFFF)",
        boxShadow: "0 0 0 2px var(--z-accent)",
      },
    },
  },
});

/** The open tab's name; shortens before the bar grows past the screen */
const TabName = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const TabIcon = styled("span", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    height: "28px",
  },
});

const Badge = styled("span", {
  base: {
    position: "absolute",
    top: "-3px",
    insetInlineStart: "60%",
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
    boxShadow: "0 0 0 2px var(--z-bg-raised)",
  },
});
