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
import { pendingUpdate } from "../../serviceWorkerInterface";
import { openMentions } from "./MentionsPanel";
import { openYouSheet } from "./YouSheet";

/** the last server visited, so the Servers tab returns to it */
const [lastServer, setLastServer] = createSignal<string>();

/**
 * Phone navigation, floating over the bottom of the menu side (the design
 * the owner picked on 2026-11-17, replacing the square strip of 2026-11-16):
 * a rounded capsule with the four places (Servers, Messages, Discover,
 * Mentions) and, beside it, your picture as a round button of its own (You).
 * Icons only; the open tab stretches into a pill that shows its name, its
 * icon in the action colour. Every tab keeps its name for screen readers.
 * Hidden on wider screens, where the rail and account card do this job.
 */
/**
 * @param props.page The bar under a tab's own page (Discover, You), on the
 *   page side of the phone's slide: Servers and Messages lead back to the
 *   menu side from there. Without it the page had no way out but a swipe,
 *   and an installed app has no browser Back button.
 */
export function PhoneTabs(props: { page?: boolean }) {
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
    toMenuSide();
  };

  const openMessages = () => {
    if (active() !== "messages") navigate("/app");
    toMenuSide();
  };

  /** from a tab's page, the lists are on the other side of the slide */
  const toMenuSide = () => {
    if (props.page) state.appDrawer()?.setShown(false);
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
    <Bar
      // two names: tests and the menu side's layout rules look for the
      // first, and must not find the page's copy
      data-phone-tabs={props.page ? undefined : ""}
      data-phone-tabs-page={props.page ? "" : undefined}
      aria-label={t`Main navigation`}
    >
      {/* You: first, so it stands on the servers' side, under the rail,
          where the account sits on wide screens (owner, 2026-11-17). It
          opens as a sheet over whatever is on screen, as Mentions does */}
      <Tab
        type="button"
        data-me
        aria-haspopup="dialog"
        aria-current={active() === "you" ? "page" : undefined}
        data-current={active() === "you"}
        onClick={openYouSheet}
      >
        <TabIcon>
          <Avatar
            size={36}
            src={user()?.animatedAvatarURL}
            fallback={user()?.username}
          />
        </TabIcon>
        <TabName>{t`You`}</TabName>
      </Tab>
      <Capsule>
        {tab("servers", "squares-four", t`Servers`, openServers)}
        {/* the speech bubble with three dots ("chat-circle-dots" draws an
            eye in the bubble, which did not read as messages) */}
        {tab("messages", "chat-circle", t`Messages`, openMessages, () =>
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
      </Capsule>
    </Bar>
  );
}

/**
 * Phones: a new release is ready. One quiet row on top of the tab bar; the
 * page reloads only when "Update" is tapped (src/swUpdate.ts). The Sidebar
 * leaves it out during a call and gives the lists the extra room.
 */
export function PhoneUpdateRow() {
  const { t } = useLingui();

  return (
    <UpdateRow data-phone-update role="status">
      <Icon name="arrow-clockwise" size={20} />
      <UpdateText>{t`A new version of Zrzur is ready`}</UpdateText>
      <UpdateAction type="button" onClick={() => pendingUpdate()?.()}>
        {t`Update`}
      </UpdateAction>
    </UpdateRow>
  );
}

const UpdateRow = styled("div", {
  base: {
    display: "none",
    _phone: {
      position: "absolute",
      zIndex: 3,
      insetInline: 0,
      // on top of the floating tab bar (58px, 10px above the edge)
      bottom: "78px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minHeight: "48px",
      paddingInlineStart: "16px",
      paddingInlineEnd: "4px",
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-primary)",
      background: "var(--z-bg-raised)",
      borderTop: "1px solid var(--z-border-subtle)",
      "--z-icon-color": "var(--z-icon-neutral)",
    },
  },
});

const UpdateText = styled("span", {
  base: { flex: 1, minWidth: 0 },
});

const UpdateAction = styled("button", {
  base: {
    flexShrink: 0,
    minWidth: "44px",
    minHeight: "44px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "none",
    color: "var(--z-accent-text, var(--z-accent))",
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

/** the fill of the floating bar: one step above the boxes, so it lifts */
const BAR_FILL =
  "color-mix(in srgb, var(--z-fg-primary) 8%, var(--z-bg-frame))";

const Bar = styled("nav", {
  base: {
    display: "none",
    _phone: {
      position: "absolute",
      zIndex: 3,
      // floating: in from both sides and up from the bottom edge (#root
      // already stops above the home bar, styles.css, so no inset here)
      insetInline: "12px",
      bottom: "10px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      height: "58px",
      // the room between the capsule and the round button lets a touch
      // through to the list under it
      pointerEvents: "none",
      "& > *": { pointerEvents: "auto" },
    },
  },
});

/** The four places, in one rounded capsule */
const Capsule = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    height: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: "7px",
    borderRadius: "29px",
    background: BAR_FILL,
    boxShadow: "var(--z-popover-lift, 0 12px 32px rgb(0 0 0 / 0.45))",
  },
});

const Tab = styled("button", {
  base: {
    position: "relative",
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "48px",
    height: "44px",
    paddingInline: 0,
    border: "none",
    borderRadius: "22px",
    background: "none",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    WebkitTapHighlightColor: "transparent",
    transition: "color 120ms ease, background-color 120ms ease",
    _motionReduce: { transition: "none" },

    "&:active > span:first-of-type": { scale: "0.94" },
    _active: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    // a closed tab is its icon; the name stays for screen readers
    "&:not([data-current='true']) > span:last-of-type, &[data-me] > span:last-of-type":
      {
        position: "absolute",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        clipPath: "inset(50%)",
      },
    // the open tab: a pill with its name, the icon in the action colour
    "&[data-current='true']:not([data-me])": {
      flex: "0 1 auto",
      minWidth: 0,
      paddingInline: "14px 16px",
      color: "var(--z-fg-primary)",
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
      "& > span:first-of-type": {
        "--z-icon-color": "var(--z-accent)",
        color: "var(--z-accent)",
      },
    },
    // You: your picture, a round button of its own beside the capsule
    "&[data-me]": {
      width: "58px",
      height: "58px",
      padding: 0,
      borderRadius: "50%",
      // the picture sits in the exact middle of the circle: its box is the
      // picture's own size, with no line of text under it to push it off
      "& > span:first-of-type": {
        width: "36px",
        height: "36px",
        minWidth: 0,
        lineHeight: 0,
        "& > *": { display: "block", margin: 0 },
      },
      background: BAR_FILL,
      boxShadow: "var(--z-popover-lift, 0 12px 32px rgb(0 0 0 / 0.45))",
    },
    "&[data-me][data-current='true']": {
      boxShadow:
        "0 0 0 2px var(--z-accent), var(--z-popover-lift, 0 12px 32px rgb(0 0 0 / 0.45))",
    },
  },
});

/** The tab's name; shortens inside the pill */
const TabName = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/** The icon's box: the unread count reaches past it, so it is never cut */
const TabIcon = styled("span", {
  base: {
    position: "relative",
    flex: "none",
    display: "grid",
    placeItems: "center",
    minWidth: "28px",
    height: "28px",
  },
});

const Badge = styled("span", {
  base: {
    position: "absolute",
    top: "-7px",
    insetInlineStart: "62%",
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
