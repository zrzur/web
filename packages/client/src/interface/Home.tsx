import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { For, JSX, Show, Suspense, createMemo, lazy } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient, useUser } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, Button, Header, UserStatus } from "@revolt/ui";
import { createProfileTheme } from "@revolt/ui/components/features/profiles/profileTheme";
import {
  themeColours,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon, IconName } from "@revolt/ui/icons/Icon";

import { HeaderIcon } from "./common/CommonHeader";
import { useGreeting } from "./home/greeting";

// the designs strip brings the Designs page code; it loads after the home page shows
const DesignsStrip = lazy(() =>
  import("./Designs").then((m) => ({ default: m.DesignsStrip })),
);

/**
 * Home. The sky holds the flock, one lit bird for each friend online, above
 * your greeting. Someone with no server yet gets the ways to start; everyone
 * else gets what is waiting, their servers and who is around. Support and
 * community links only appear once they are configured
 * (VITE_SUPPORT_URL / VITE_COMMUNITY_INVITE).
 */
export function HomePage() {
  const client = useClient();
  const user = useUser();
  const state = useState();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const { t } = useLingui();

  const theme = createProfileTheme(
    () => user()?.avatarURL,
    () => user()?.id,
    () => themeColours(userStyleOf(user())),
  );

  const greeting = useGreeting(
    () => user()?.displayName ?? user()?.username ?? "",
  );

  const settings = (page?: string) =>
    openModal({
      type: "settings",
      config: "user",
      context: page ? { page } : undefined,
    });

  const servers = createMemo(() =>
    state.ordering.orderedServers(client()).slice(0, 12),
  );

  const onlineFriends = createMemo(() =>
    client()
      .users.filter((u) => u.relationship === "Friend" && u.online)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, 12),
  );

  /** Conversations with something new, newest first */
  const waiting = createMemo(() =>
    state.ordering
      .orderedConversations(client())
      .filter((channel) => channel.unread)
      .slice(0, 4),
  );

  const firstRun = () => !servers().length;

  async function message(userId: string) {
    const friend = client().users.get(userId);
    if (!friend) return;
    const dm = await friend.openDM();
    navigate(`/channel/${dm.id}`);
  }

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Icon name="house" size={22} />
        </HeaderIcon>
        <Title>
          <Trans>Home</Trans>
        </Title>
      </Header>

      <Scroll>
        <Content>
          <Hero style={theme()}>
            <Who>
              <AvatarDecoration
                decoration={user()?.style?.decoration}
                file={user()?.style?.decoration_file}
                size={64}
              >
                <Avatar
                  size={64}
                  src={user()?.animatedAvatarURL}
                  fallback={user()?.username}
                  holepunch="bottom-right"
                  overlay={<UserStatus.Graphic status={user()?.presence} />}
                />
              </AvatarDecoration>
              <div>
                <h1>{greeting()}</h1>
                <p>
                  <Show
                    when={!firstRun()}
                    fallback={<Trans>Your people are one step away.</Trans>}
                  >
                    <Show
                      when={onlineFriends().length}
                      fallback={<Trans>Welcome back to Zrzur.</Trans>}
                    >
                      <Trans>Some of your friends are online.</Trans>
                    </Show>
                  </Show>
                </p>
              </div>
            </Who>
          </Hero>

          <Show when={firstRun()}>
            <Start>
              <Button
                size="xl"
                onPress={() =>
                  openModal({ type: "create_server", client: client() })
                }
              >
                <Icon name="plus" size={20} />
                <Trans>Create your server</Trans>
              </Button>
              <Ways>
                <Way
                  icon="link"
                  title={<Trans>Join with an invite</Trans>}
                  line={<Trans>A friend sent you a link? Paste it here.</Trans>}
                  onClick={() =>
                    openModal({ type: "join_server", client: client() })
                  }
                />
                <Way
                  icon="compass"
                  title={<Trans>Find a community</Trans>}
                  line={<Trans>Browse servers by what you enjoy.</Trans>}
                  onClick={() => navigate("/discover")}
                />
                <Way
                  icon="user-plus"
                  title={<Trans>Add a friend</Trans>}
                  line={<Trans>Send a request by username.</Trans>}
                  onClick={() =>
                    openModal({ type: "add_friend", client: client() })
                  }
                />
              </Ways>
            </Start>
          </Show>

          <Show when={waiting().length}>
            <Section>
              <SectionHead>
                <h2>
                  <Trans>Waiting for you</Trans>
                </h2>
              </SectionHead>
              <Waiting>
                <For each={waiting()}>
                  {(channel) => (
                    <WaitingRow
                      type="button"
                      onClick={() => navigate(`/channel/${channel.id}`)}
                    >
                      <Avatar
                        size={32}
                        src={
                          channel.animatedIconURL ??
                          channel.iconURL ??
                          channel.recipient?.animatedAvatarURL
                        }
                        fallback={channel.displayName}
                      />
                      <span dir="auto">{channel.displayName}</span>
                      <Show when={channel.mentions?.size}>
                        <Count>{channel.mentions!.size}</Count>
                      </Show>
                    </WaitingRow>
                  )}
                </For>
              </Waiting>
            </Section>
          </Show>

          <Show when={!firstRun()}>
            <Section>
              <SectionHead>
                <h2>
                  <Trans>Your servers</Trans>
                </h2>
              </SectionHead>
              <ServerGrid>
                <For each={servers()}>
                  {(server) => (
                    <ServerTile
                      type="button"
                      title={server.name}
                      data-unread={server.unread || undefined}
                      onClick={() =>
                        navigate(
                          state.layout.getLastActiveServerPath(server.id),
                        )
                      }
                    >
                      <Avatar
                        size={48}
                        shape="rounded-square"
                        src={server.animatedIconURL}
                        fallback={server.name}
                      />
                      <span dir="auto">{server.name}</span>
                    </ServerTile>
                  )}
                </For>
                <ServerTile
                  type="button"
                  data-add
                  onClick={() =>
                    openModal({
                      type: "create_or_join_server",
                      client: client(),
                    })
                  }
                >
                  <AddTile>
                    <Icon name="plus" size={20} />
                  </AddTile>
                  <span>
                    <Trans>Add a server</Trans>
                  </span>
                </ServerTile>
              </ServerGrid>
            </Section>
          </Show>

          <Show when={onlineFriends().length}>
            <Section>
              <SectionHead>
                <h2>
                  <Trans>Friends online</Trans>
                </h2>
                <LinkButton type="button" onClick={() => navigate("/friends")}>
                  <Trans>See all</Trans>
                </LinkButton>
              </SectionHead>
              <FriendRow>
                <For each={onlineFriends()}>
                  {(friend) => (
                    <FriendChip
                      type="button"
                      title={t`Message ${friend.displayName}`}
                      onClick={() => void message(friend.id)}
                    >
                      <AvatarDecoration
                        decoration={friend?.style?.decoration}
                        file={friend?.style?.decoration_file}
                        size={32}
                      >
                        <Avatar
                          size={32}
                          src={friend.animatedAvatarURL}
                          fallback={friend.displayName}
                          holepunch="bottom-right"
                          overlay={
                            <UserStatus.Graphic status={friend.presence} />
                          }
                        />
                      </AvatarDecoration>
                      <span dir="auto">{friend.displayName}</span>
                    </FriendChip>
                  )}
                </For>
              </FriendRow>
            </Section>
          </Show>

          <Footer>
            <Show when={CONFIGURATION.COMMUNITY_INVITE}>
              <FooterLink
                icon="users-three"
                onClick={() =>
                  navigate(`/invite/${CONFIGURATION.COMMUNITY_INVITE}`)
                }
              >
                <Trans>Join the Zrzur community</Trans>
              </FooterLink>
            </Show>
            <FooterLink
              icon="chat-centered-text"
              onClick={() => settings("feedback")}
            >
              <Trans>Give feedback</Trans>
            </FooterLink>
            <FooterLink icon="gear-six" onClick={() => settings()}>
              <Trans>Open settings</Trans>
            </FooterLink>
            <FooterLink icon="code" onClick={() => navigate("/developers")}>
              <Trans>Developer Portal</Trans>
            </FooterLink>
            <Show when={CONFIGURATION.SUPPORT_URL}>
              <FooterLink icon="heart" href={CONFIGURATION.SUPPORT_URL}>
                <Trans>Donate to Zrzur</Trans>
              </FooterLink>
            </Show>
          </Footer>

          {/* its own boundary: without it the whole page waits for this code.
              Last on the page: it comes late, and moves nothing this way */}
          <Suspense>
            <DesignsStrip />
          </Suspense>
        </Content>
      </Scroll>
    </Base>
  );
}

/** One way to start: icon, what it is, one line */
function Way(props: {
  icon: IconName;
  title: JSX.Element;
  line: JSX.Element;
  onClick: () => void;
}) {
  return (
    <WayButton type="button" onClick={props.onClick}>
      <Icon name={props.icon} size={20} />
      <span>
        <strong>{props.title}</strong>
        <small>{props.line}</small>
      </span>
      <Icon name="caret-right" size={16} />
    </WayButton>
  );
}

/** Small text link with an icon; an external link when `href` is set */
function FooterLink(props: {
  icon: IconName;
  children: JSX.Element;
  onClick?: () => void;
  href?: string;
}) {
  return (
    <Show
      when={props.href}
      fallback={
        <Quiet type="button" onClick={() => props.onClick?.()}>
          <Icon name={props.icon} size={16} />
          {props.children}
        </Quiet>
      }
    >
      <QuietLink href={props.href} target="_blank" rel="noopener noreferrer">
        <Icon name={props.icon} size={16} />
        {props.children}
      </QuietLink>
    </Show>
  );
}

const Base = styled("main", {
  base: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    color: "var(--z-fg-primary)",
  },
});

const Title = styled("span", {
  base: { fontSize: "15px", fontWeight: 600 },
});

const Scroll = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
  },
});

/** Your welcome, in your own profile colours */
const Hero = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "24px",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-card-border)",
    color: "#fff",
    boxShadow: "var(--z-card-lift)",
    _phone: { padding: "16px", gap: "16px" },
  },
});

const Who = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minWidth: 0,

    "& h1": {
      margin: 0,
      fontSize: "24px",
      lineHeight: "30px",
      fontWeight: 700,
      overflowWrap: "anywhere",
    },
    "& p": {
      margin: "4px 0 0",
      fontSize: "14px",
      // full white: anything less was under 4.5:1 on a light profile colour
      color: "#fff",
    },
  },
});

const Content = styled("div", {
  base: {
    width: "100%",
    maxWidth: "808px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: "24px 24px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    _phone: { padding: "16px 16px 24px", gap: "24px" },
  },
});

/** First run: one filled action, then the other ways in */
const Start = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    _phone: {
      alignItems: "stretch",
      // the filled action sits under the thumb, after the choices
      flexDirection: "column-reverse",
    },
  },
});

const Ways = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    width: "100%",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
    },
  },
});

const WayButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    padding: "12px",
    boxSizing: "border-box",
    border: "1px solid var(--z-border-soft)",
    borderRadius: "14px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: {
      background: "var(--z-bg-raised)",
      borderColor: "var(--z-border-strong)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    "& > span": {
      flexGrow: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& strong": { fontSize: "15px", lineHeight: "20px", fontWeight: 600 },
    "& small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    // one column for the icons, so the words line up from row to row
    "& > :first-child": {
      flex: "0 0 24px",
      width: "24px",
      justifyContent: "center",
    },
    "& > :last-child": {
      "@media (min-width: 901px)": { display: "none" },
    },
  },
});

const Section = styled("section", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "24px",
    "& h2": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
  },
});

const LinkButton = styled("button", {
  base: {
    // 24 px target everywhere (WCAG 2.5.8), 44 px on phones (phone rules)
    minHeight: "24px",
    _phone: { minWidth: "44px", minHeight: "44px", marginBlock: "-10px" },
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-accent-text, var(--z-accent))",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
  },
});

const Waiting = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "4px 12px",
  },
});

const WaitingRow = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    minWidth: 0,
    paddingInline: "8px 12px",
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: { background: "var(--z-nav-hover)" },
    "&:active": { background: "var(--z-nav-selected)" },
    "& > span[dir]": {
      flexGrow: 1,
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});

const Count = styled("span", {
  base: {
    minWidth: "20px",
    height: "20px",
    paddingInline: "6px",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-on-mention-badge)",
    background: "var(--z-mention-badge)",
  },
});

const ServerGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
    gap: "8px",
    // phones: one swipeable row, so a long server list does not push the
    // friends and the rest of the page off the screen
    _phone: {
      display: "flex",
      overflowX: "auto",
      scrollSnapType: "x proximity",
      scrollbarWidth: "none",
      marginInline: "-16px",
      paddingInline: "16px",
      "&::-webkit-scrollbar": { display: "none" },
      "& > *": { flex: "0 0 88px", scrollSnapAlign: "start" },
    },
  },
});

const ServerTile = styled("button", {
  base: {
    // the letter tile sits on the page colour now, so it takes one step up
    "--md-sys-color-surface-container-low": "var(--z-bg-raised)",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    padding: "12px 8px",
    borderRadius: "14px",
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    cursor: "pointer",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: {
      background: "var(--z-bg-raised)",
      borderColor: "var(--z-border-soft)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },

    "& > span:last-child": {
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      fontSize: "13px",
      lineHeight: "20px",
      fontWeight: 500,
      color: "var(--z-fg-secondary)",
    },
    // a label, not a name: it wraps rather than ending in "…"
    "&[data-add] > span:last-child": {
      whiteSpace: "normal",
      textAlign: "center",
    },
    "&:hover > span:last-child, &[data-unread] > span:last-child": {
      color: "var(--z-fg-primary)",
    },
    "&[data-unread] > span:last-child": { fontWeight: 600 },
    // an unread server: a small dot as on the rail, not only bolder text
    "&[data-unread]::after": {
      content: "''",
      position: "absolute",
      top: "12px",
      insetInlineEnd: "calc(50% - 32px)",
      width: "8px",
      height: "8px",
      borderRadius: "999px",
      background: "var(--z-unread)",
    },
  },
});

const AddTile = styled("span", {
  base: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
    borderRadius: "14px",
    border: "1px dashed var(--z-border-strong)",
    boxSizing: "border-box",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const FriendRow = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const FriendChip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "220px",
    height: "44px",
    paddingInline: "6px 12px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-soft)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: {
      background: "var(--z-bg-raised)",
      borderColor: "var(--z-border-strong)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "& span[dir]": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    paddingTop: "16px",
    borderTop: "1px solid var(--z-border-subtle)",
  },
});

const quietStyle = {
  // phones: a 44 px tap target (phone rules)
  _phone: { minHeight: "44px" },
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  height: "32px",
  paddingInline: "8px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  color: "var(--z-fg-secondary)",
  font: "inherit",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  cursor: "pointer",
  "--z-icon-color": "var(--z-icon-neutral)",
  transition: "background-color 120ms ease, color 120ms ease",
  _hover: {
    background: "var(--z-nav-hover)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-hover)",
  },
  "&:active": { background: "var(--z-nav-selected)" },
  _focusVisible: {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "1px",
  },
} as const;

const Quiet = styled("button", { base: quietStyle });
const QuietLink = styled("a", { base: quietStyle });
