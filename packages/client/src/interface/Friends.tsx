import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { statusLine } from "@revolt/common/lib/statusWrite";
import { TextWithEmoji } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Avatar,
  Button,
  EmptyState,
  Header,
  IconButton,
  UserStatus,
  main,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { HeaderIcon } from "./common/CommonHeader";

type Page = "online" | "all" | "pending" | "blocked";

/**
 * Friends page
 */
export function Friends() {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const { layout } = useDevice();
  const [page, setPage] = createSignal<Page>("online");
  const [query, setQuery] = createSignal("");

  const lists = createMemo(() => {
    const list = client()!.users.toList();
    const byName = (a: User, b: User) =>
      a.displayName.localeCompare(b.displayName);

    const friends = list
      .filter((user) => user.relationship === "Friend")
      .sort(byName);

    return {
      friends,
      online: friends.filter((user) => user.online),
      incoming: list
        .filter((user) => user.relationship === "Incoming")
        .sort(byName),
      outgoing: list
        .filter((user) => user.relationship === "Outgoing")
        .sort(byName),
      blocked: list
        .filter((user) => user.relationship === "Blocked")
        .sort(byName),
    };
  });

  const matches = (users: User[]) => {
    const q = query().trim().toLowerCase();
    return q
      ? users.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q),
        )
      : users;
  };

  const pendingCount = () => lists().incoming.length;

  const addFriend = () => openModal({ type: "add_friend", client: client() });

  const tabs: { value: Page; label: () => JSX.Element }[] = [
    { value: "online", label: () => <Trans>Online</Trans> },
    { value: "all", label: () => <Trans>All</Trans> },
    { value: "pending", label: () => <Trans>Pending</Trans> },
    { value: "blocked", label: () => <Trans>Blocked</Trans> },
  ];

  const phone = () => layout() === "phone";

  const tabsEl = () => (
    <Tabs role="tablist" aria-label={t`Friends filter`}>
      <For each={tabs}>
        {(tab) => (
          <Tab
            role="tab"
            type="button"
            aria-selected={page() === tab.value}
            onClick={() => setPage(tab.value)}
          >
            {tab.label()}
            <Show when={tab.value === "pending" && pendingCount()}>
              <Count>{pendingCount() > 99 ? "99+" : pendingCount()}</Count>
            </Show>
          </Tab>
        )}
      </For>
    </Tabs>
  );

  const searchEl = () => (
    <Search>
      <Icon name="magnifying-glass" size={16} />
      <input
        type="search"
        placeholder={t`Search`}
        aria-label={t`Search friends`}
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
    </Search>
  );

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Icon name="users" size={22} />
        </HeaderIcon>
        <Title>
          <Trans>Friends</Trans>
        </Title>
        <Show when={!phone()} fallback={<Spacer />}>
          <Divider />
          {tabsEl()}
          <Spacer />
          {searchEl()}
        </Show>
        <Button size="sm" onPress={addFriend} aria-label={t`Add friend`}>
          <Icon name="user-plus" size={16} />
          <WideOnly>
            <Trans>Add friend</Trans>
          </WideOnly>
        </Button>
      </Header>
      {/* phones: the filters and the search get their own rows under the title */}
      <Show when={phone()}>
        <PhoneFilters>
          {tabsEl()}
          {searchEl()}
        </PhoneFilters>
      </Show>

      <main class={main()}>
        <Scroll>
          <Content>
            <Results>
              <Switch>
                <Match when={page() === "online"}>
                  <Group
                    title={<Trans>Online</Trans>}
                    users={matches(lists().online)}
                    empty={
                      <EmptyState
                        minimalArt
                        art={query() ? "search" : "online"}
                        title={
                          query() ? (
                            <Trans>No one matches that search</Trans>
                          ) : (
                            <Trans>No friends online right now</Trans>
                          )
                        }
                        description={
                          <Show when={!query()}>
                            <Trans>
                              When your friends come online, they show up here.
                            </Trans>
                          </Show>
                        }
                        action={
                          <Show when={!query()}>
                            <Button
                              size="sm"
                              variant="tonal"
                              onPress={addFriend}
                            >
                              <Trans>Add a friend</Trans>
                            </Button>
                          </Show>
                        }
                      />
                    }
                  />
                </Match>
                <Match when={page() === "all"}>
                  <Group
                    title={<Trans>All friends</Trans>}
                    users={matches(lists().friends)}
                    empty={
                      <EmptyState
                        minimalArt
                        art={query() ? "search" : "friends"}
                        title={
                          query() ? (
                            <Trans>No one matches that search</Trans>
                          ) : (
                            <Trans>Your friends list is empty</Trans>
                          )
                        }
                        description={
                          <Show when={!query()}>
                            <Trans>
                              Add people by their username to chat, call and
                              play together.
                            </Trans>
                          </Show>
                        }
                        action={
                          <Show when={!query()}>
                            <Button
                              size="sm"
                              variant="tonal"
                              onPress={addFriend}
                            >
                              <Trans>Add friend</Trans>
                            </Button>
                          </Show>
                        }
                      />
                    }
                  />
                </Match>
                <Match when={page() === "pending"}>
                  <Show
                    when={
                      matches(lists().incoming).length ||
                      matches(lists().outgoing).length
                    }
                    fallback={
                      <EmptyState
                        minimalArt
                        art="pending"
                        title={<Trans>No pending requests</Trans>}
                        description={
                          <Trans>
                            Friend requests you send or receive wait here.
                          </Trans>
                        }
                      />
                    }
                  >
                    <Show when={matches(lists().incoming).length}>
                      <Group
                        title={<Trans>Incoming</Trans>}
                        users={matches(lists().incoming)}
                        kind="incoming"
                      />
                    </Show>
                    <Show when={matches(lists().outgoing).length}>
                      <Group
                        title={<Trans>Outgoing</Trans>}
                        users={matches(lists().outgoing)}
                        kind="outgoing"
                      />
                    </Show>
                  </Show>
                </Match>
                <Match when={page() === "blocked"}>
                  <Group
                    title={<Trans>Blocked</Trans>}
                    users={matches(lists().blocked)}
                    kind="blocked"
                    empty={
                      <EmptyState
                        minimalArt
                        art="blocked"
                        title={<Trans>You haven't blocked anyone</Trans>}
                        description={
                          <Trans>
                            Blocked people can't message you or send requests.
                          </Trans>
                        }
                      />
                    }
                  />
                </Match>
              </Switch>
            </Results>
          </Content>
        </Scroll>
      </main>
    </Base>
  );
}

/**
 * Heading + rows for one group of people
 */
function Group(props: {
  title: JSX.Element;
  users: User[];
  kind?: "friend" | "incoming" | "outgoing" | "blocked";
  empty?: JSX.Element;
}) {
  return (
    <Show when={props.users.length || !props.empty} fallback={props.empty}>
      <GroupHeading>
        {props.title} — {props.users.length}
      </GroupHeading>
      <Rows role="list">
        <For each={props.users}>
          {(user) => <Person user={user} kind={props.kind ?? "friend"} />}
        </For>
      </Rows>
    </Show>
  );
}

/**
 * One person row with contextual actions
 */
function Person(props: {
  user: User;
  kind: "friend" | "incoming" | "outgoing" | "blocked";
}) {
  const { t } = useLingui();
  const { openModal } = useModals();
  const navigate = useNavigate();

  const statusText = () =>
    props.kind === "incoming"
      ? t`Incoming friend request`
      : props.kind === "outgoing"
        ? t`Outgoing friend request`
        : props.kind === "blocked"
          ? t`Blocked`
          : statusLine(props.user.statusEmoji, props.user.status?.text) ||
            (props.user.online
              ? props.user.presence === "Busy"
                ? t`Do not disturb`
                : props.user.presence === "Idle"
                  ? t`Idle`
                  : props.user.presence === "Focus"
                    ? t`Focus`
                    : t`Online`
              : t`Offline`);

  async function message() {
    const channel = await props.user.openDM();
    navigate(`/channel/${channel.id}`);
  }

  return (
    <div
      class={row()}
      role="listitem"
      tabIndex={0}
      onClick={() => openModal({ type: "user_profile", user: props.user })}
      onKeyDown={(e) => {
        if (e.key === "Enter")
          openModal({ type: "user_profile", user: props.user });
      }}
      use:floating={{
        contextMenu: () => <UserContextMenu user={props.user} />,
      }}
    >
      <AvatarDecoration
        decoration={props.user?.style?.decoration}
        file={props.user?.style?.decoration_file}
        size={36}
      >
        <Avatar
          size={36}
          src={props.user.animatedAvatarURL}
          fallback={props.user.displayName}
          holepunch={props.kind === "friend" ? "bottom-right" : "none"}
          overlay={
            <Show when={props.kind === "friend"}>
              <UserStatus.Graphic status={props.user.presence} />
            </Show>
          }
        />
      </AvatarDecoration>
      <Names>
        <strong>
          <b style={nameStyle(props.user.style)}>{props.user.displayName}</b>
          <span>{props.user.username}</span>
        </strong>
        <small>
          <TextWithEmoji content={statusText()} />
        </small>
      </Names>
      <Actions onClick={(e) => e.stopPropagation()}>
        <Switch>
          <Match when={props.kind === "friend"}>
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Message`}
              use:floating={{
                tooltip: { placement: "top", content: t`Message` },
              }}
              onPress={message}
            >
              <Icon name="chat-circle" size={18} />
            </IconButton>
          </Match>
          <Match when={props.kind === "incoming"}>
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Accept`}
              use:floating={{
                tooltip: { placement: "top", content: t`Accept` },
              }}
              onPress={() => props.user.addFriend()}
            >
              <Icon name="check" size={18} />
            </IconButton>
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Ignore`}
              use:floating={{
                tooltip: { placement: "top", content: t`Ignore` },
              }}
              onPress={() => props.user.removeFriend()}
            >
              <Icon name="x" size={18} />
            </IconButton>
          </Match>
          <Match when={props.kind === "outgoing"}>
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Cancel request`}
              use:floating={{
                tooltip: { placement: "top", content: t`Cancel request` },
              }}
              onPress={() => props.user.removeFriend()}
            >
              <Icon name="x" size={18} />
            </IconButton>
          </Match>
          <Match when={props.kind === "blocked"}>
            <Button
              size="xs"
              variant="tonal"
              onPress={() => props.user.unblockUser()}
            >
              <Trans>Unblock</Trans>
            </Button>
          </Match>
        </Switch>
        <IconButton
          variant="toolbar"
          size="xs"
          aria-label={t`More`}
          use:floating={{
            tooltip: { placement: "top", content: t`More` },
            contextMenu: () => <UserContextMenu user={props.user} />,
            contextMenuHandler: "click",
          }}
        >
          <Icon name="dots-three-vertical" size={18} />
        </IconButton>
      </Actions>
    </div>
  );
}

const Base = styled("div", {
  base: {
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
  },
});

const Title = styled("span", {
  base: { fontSize: "16px", fontWeight: 600 },
});

const Divider = styled("span", {
  base: {
    width: "1px",
    height: "20px",
    marginInline: "4px",
    background: "var(--z-border-strong)",
  },
});

const PhoneFilters = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px 16px 12px",
    borderBottom: "1px solid var(--z-border-subtle)",
    "& label": {
      // the header hides the search below 700 px; on its own row it fits
      display: "flex",
      width: "100%",
      maxWidth: "none",
      height: "44px",
      marginInlineEnd: 0,
    },
    "& label:focus-within, & label:has(input:not(:placeholder-shown))": {
      width: "100%",
    },
    "& label input": { fontSize: "16px" },
  },
});

const Tabs = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    // narrow screens: the filters scroll sideways instead of running off
    flex: "1 1 auto",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  },
});

/** the button keeps its icon on a phone; the words return on wider screens */
const WideOnly = styled("span", {
  base: { "@media (max-width: 599px)": { display: "none" } },
});

const Tab = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "30px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",

    "&:hover": {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-hover)",
    },
    // the current tab is raised like a button
    "&[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      background: "var(--z-tab-active-bg)",
      boxShadow: "var(--z-tab-active-lift)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
});

const Count = styled("span", {
  base: {
    minWidth: "18px",
    height: "16px",
    paddingInline: "5px",
    borderRadius: "8px",
    display: "grid",
    placeItems: "center",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--z-on-danger, #FFFFFF)",
    background: "var(--z-danger-strong, var(--z-badge))",
  },
});

const Spacer = styled("div", { base: { flexGrow: 1 } });

const Scroll = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
  },
});

const Content = styled("div", {
  base: {
    width: "100%",
    minHeight: "100%",
    boxSizing: "border-box",
    padding: "16px 24px 32px",
    display: "flex",
    flexDirection: "column",
  },
});

const Results = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    "& > [data-empty-state]": {
      marginBlock: "auto",
      flexShrink: 0,
      width: "100%",
    },
  },
});

/** Compact search in the header, next to Add friend; grows a little on focus */
const Search = styled("label", {
  base: {
    flexShrink: 1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "200px",
    minWidth: "120px",
    height: "34px",
    paddingInline: "10px",
    marginInlineEnd: "8px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-field-bg)",
    border: "1px solid var(--z-field-border)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    cursor: "text",
    transition:
      "width 0.18s var(--z-ease-standard, ease), border-color 0.15s ease, box-shadow 0.22s ease",
    "--z-icon-color": "currentColor",
    _motionReduce: { transition: "none" },

    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
    },
    "&:focus-within, &:has(input:not(:placeholder-shown))": {
      width: "260px",
    },
    "&:focus-within": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
      color: "var(--z-accent)",
    },
    "& input::-webkit-search-cancel-button": { display: "none" },
    "& input": {
      flexGrow: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      fontSize: "14px",
      fontFamily: "inherit",
    },
    "& input::placeholder": { color: "var(--z-fg-muted)" },
    "@media (max-width: 699px)": { display: "none" },
  },
});

const GroupHeading = styled("div", {
  base: {
    width: "100%",
    maxWidth: "860px",
    alignSelf: "center",
    marginTop: "4px",
    padding: "0 4px 8px",
    fontSize: "12px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

/** A group of people: one card, rows split by hairlines (like settings) */
const Rows = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "860px",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: "14px",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
  },
});

const row = cva({
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    height: "62px",
    paddingInline: "14px",
    cursor: "pointer",
    transition: "background-color 0.12s ease",

    // hairline between rows, starting after the avatar
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInlineStart: "62px",
      insetInlineEnd: "14px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },

    "&:hover, &:focus-visible": {
      outline: "none",
      background: "var(--z-nav-hover)",
    },
    "&:active": { background: "var(--z-nav-selected)" },
    "&:focus-visible": { boxShadow: "inset 0 0 0 2px var(--z-focus)" },
    // reveal the @username on hover/focus
    "&:hover strong span, &:focus-visible strong span": { opacity: 1 },
  },
});

const Names = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",

    "& strong": {
      display: "flex",
      alignItems: "baseline",
      gap: "6px",
      fontSize: "15px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& strong span": {
      fontSize: "13px",
      fontWeight: 400,
      color: "var(--z-fg-muted)",
      opacity: 0,
      transition: "opacity 0.12s ease",
    },
    "& small": {
      fontSize: "13px",
      color: "var(--z-fg-muted)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    // row actions: round surface buttons that light up on hover
    "& button": {
      width: "34px !important",
      height: "34px !important",
      borderRadius: "50% !important",
      background: "var(--z-btn-surface-bg) !important",
      border: "1px solid var(--z-btn-surface-border) !important",
      boxShadow: "var(--z-btn-surface-lift)",
      "--z-icon-color": "var(--z-icon-neutral)",
    },
    "& button:hover": {
      background: "var(--z-btn-surface-hover) !important",
      "--z-icon-color": "var(--z-accent)",
    },
    "& button:active": { boxShadow: "var(--z-btn-pressed)" },
  },
});
