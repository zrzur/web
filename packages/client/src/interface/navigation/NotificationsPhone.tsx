import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import type { Message, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { openInbox } from "@revolt/app/interface/saved/inboxView";
import { savedRemindersEnabled } from "@revolt/app/interface/saved/savedModel";
import { arrivedReminders } from "@revolt/app/interface/saved/savedStore";
import { useClient } from "@revolt/client";
import { holdMessages } from "@revolt/client/messagePruner";
import { useTime } from "@revolt/i18n/dayjs";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Avatar, CircularProgress } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

type Filter = "all" | "mentions" | "friends";

/**
 * The Notifications page on phones (design approved by the owner,
 * 2026-11-16): what waits for you in one list. Friend requests come first,
 * each with its answer buttons; then the messages of the last 30 days that
 * mention you, by day, with where it was said and the words themselves.
 * A dot marks a mention you have not opened yet.
 */
export function NotificationsPhone(props: { onClose: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const state = useState();
  const dayjs = useTime();
  const { openModal, showError } = useModals();

  const [filter, setFilter] = createSignal<Filter>("all");
  const [mentions] = createResource(() => client().fetchMentions(50));
  // these come from many channels: they stay in the message cache while the
  // page is open
  onCleanup(
    // read when the cache is looked through, not tracked
    // eslint-disable-next-line solid/reactivity
    holdMessages(() =>
      mentions.state === "ready" ? mentions().map((message) => message.id) : [],
    ),
  );

  const requests = createMemo(() =>
    client().users.filter((user) => user.relationship === "Incoming"),
  );

  /** the messages by day: today, yesterday, then everything earlier */
  const days = createMemo(() => {
    const list = mentions.state === "ready" ? mentions() : [];
    const now = dayjs();
    const groups: { label: string; items: Message[] }[] = [
      { label: t`Today`, items: [] },
      { label: t`Yesterday`, items: [] },
      { label: t`Earlier`, items: [] },
    ];
    for (const message of list) {
      const at = dayjs(message.createdAt);
      if (at.isSame(now, "day")) groups[0].items.push(message);
      else if (at.isSame(now.subtract(1, "day"), "day"))
        groups[1].items.push(message);
      else groups[2].items.push(message);
    }
    return groups.filter((group) => group.items.length);
  });

  // server and channel apart: an Arabic name beside a Latin one must not
  // swap their order
  const place = (message: Message): string[] => {
    const channel = message.channel;
    if (!channel) return [];
    if (channel.type === "DirectMessage") return [t`Direct message`];
    const name =
      channel.type === "SavedMessages" ? t`Saved notes` : `#${channel.name}`;
    return channel.server ? [channel.server.name, name] : [name];
  };

  /**
   * The place as it is shown: each name keeps its own direction (in an
   * Arabic line "#Announcements" came out as "Announcements#")
   */
  const placed = (message: Message) => (
    <For each={place(message)}>
      {(part, index) => (
        <>
          {index() ? " · " : ""}
          <bdi>{part}</bdi>
        </>
      )}
    </For>
  );

  const when = (message: Message) => {
    const at = dayjs(message.createdAt);
    return at.isSame(dayjs(), "day") ? at.format("LT") : at.format("L");
  };

  const isNew = (message: Message) =>
    !!message.channel?.mentions?.has(message.id);

  const open = (message: Message) => {
    navigate(message.path);
    state.appDrawer()?.setShown(true);
    props.onClose();
  };

  const message = (user: User) =>
    user
      .openDM()
      .then((channel) => {
        navigate(`/channel/${channel.id}`);
        state.appDrawer()?.setShown(true);
        props.onClose();
      })
      .catch(showError);

  const profileLabel = (user: User) => {
    const name = user.displayName;
    return t`Open ${name}'s profile`;
  };

  const openProfile = (user: User) => {
    props.onClose();
    openModal({ type: "user_profile", user });
  };

  const showRequests = () => filter() !== "mentions" && requests().length > 0;
  const showMentions = () => filter() !== "friends";
  const nothing = () =>
    !showRequests() &&
    (!showMentions() || (mentions.state === "ready" && !mentions().length));

  const filters: { value: Filter; label: () => string }[] = [
    { value: "all", label: () => t`All` },
    { value: "mentions", label: () => t`Mentions` },
    { value: "friends", label: () => t`Friends` },
  ];

  return (
    <Page role="dialog" aria-modal="true" aria-label={t`Notifications`}>
      <Head>
        <h1>
          <Trans>Notifications</Trans>
        </h1>
        <Close type="button" aria-label={t`Close`} onClick={props.onClose}>
          <Icon name="x" size={22} />
        </Close>
      </Head>

      <Filters role="radiogroup" aria-label={t`Notifications`}>
        <For each={filters}>
          {(item) => (
            <Chip
              type="button"
              role="radio"
              aria-checked={filter() === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label()}
            </Chip>
          )}
        </For>
        {/* reminders and saved messages have their own lists */}
        <Show when={savedRemindersEnabled(client())}>
          <Chip
            type="button"
            role="radio"
            aria-checked={false}
            data-testid="notifications-reminders"
            onClick={() => openInbox("reminders")}
          >
            <Trans>Reminders</Trans>
            <Show when={arrivedReminders().length}>
              {" "}
              {arrivedReminders().length}
            </Show>
          </Chip>
          <Chip
            type="button"
            role="radio"
            aria-checked={false}
            data-testid="notifications-saved"
            onClick={() => openInbox("saved")}
          >
            <Trans>Saved list</Trans>
          </Chip>
        </Show>
      </Filters>

      <List>
        <Show when={showRequests()}>
          <Group>
            <Trans>Friend requests</Trans>
          </Group>
          <Rows>
            <For each={requests()}>
              {(user) => (
                <Request data-new>
                  {/* who sent it: one area that opens their profile (the
                      page is closed first, it would cover the profile; the
                      profile has its own Accept) */}
                  <Who
                    type="button"
                    data-testid="friend-request-profile"
                    aria-label={profileLabel(user)}
                    onClick={() => openProfile(user)}
                  >
                    <Avatar
                      size={44}
                      src={user.animatedAvatarURL}
                      fallback={user.displayName}
                    />
                    <Text>
                      <p>
                        <Trans>
                          <strong dir="auto">{user.displayName}</strong> sent
                          you a friend request.
                        </Trans>
                      </p>
                    </Text>
                  </Who>
                  <Answers data-request>
                    <Answer
                      type="button"
                      data-primary
                      onClick={() => user.addFriend().catch(showError)}
                    >
                      <Trans>Accept</Trans>
                    </Answer>
                    <Answer
                      type="button"
                      onClick={() => user.removeFriend().catch(showError)}
                    >
                      <Trans>Decline</Trans>
                    </Answer>
                    <Answer type="button" onClick={() => message(user)}>
                      <Trans>Send message</Trans>
                    </Answer>
                  </Answers>
                </Request>
              )}
            </For>
          </Rows>
        </Show>

        <Show when={showMentions()}>
          <Switch>
            <Match when={mentions.loading}>
              <Center>
                <CircularProgress />
              </Center>
            </Match>
            <Match when={mentions.error}>
              <Center role="status">
                <Icon name="warning-circle" size={22} />
                <Trans>Mentions couldn't load. Try again soon.</Trans>
              </Center>
            </Match>
            <Match when={days().length}>
              <For each={days()}>
                {(day) => (
                  <>
                    <Group>{day.label}</Group>
                    <Rows>
                      <For each={day.items}>
                        {(item) => (
                          <RowButton
                            type="button"
                            data-new={isNew(item) ? "" : undefined}
                            onClick={() => open(item)}
                          >
                            <Avatar
                              size={44}
                              src={item.animatedAvatarURL}
                              fallback={item.username}
                            />
                            <Text>
                              <p>
                                <Trans>
                                  <strong dir="auto">{item.username}</strong>{" "}
                                  mentioned you in{" "}
                                  <strong>{placed(item)}</strong>
                                </Trans>
                              </p>
                              <Quote>
                                <bdi>
                                  {client().markdownToText(item.content)}
                                </bdi>
                              </Quote>
                            </Text>
                            <When>
                              {when(item)}
                              <Show when={isNew(item)}>
                                <Dot aria-label={t`Unread`} />
                              </Show>
                            </When>
                          </RowButton>
                        )}
                      </For>
                    </Rows>
                  </>
                )}
              </For>
            </Match>
          </Switch>
        </Show>

        <Show when={nothing()}>
          <Center role="status">
            <Icon name="bell" size={22} />
            <Trans>
              Nothing waits for you. New mentions and friend requests show here.
            </Trans>
          </Center>
        </Show>
      </List>
    </Page>
  );
}

/** The whole screen under the status bar, above the home bar */
const Page = styled("div", {
  base: {
    position: "fixed",
    zIndex: 999,
    top: "var(--z-safe-top, 0px)",
    insetInline: 0,
    bottom: "calc(var(--z-safe-bottom, 0px) + var(--z-screen-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-nav, var(--z-bg-shell))",
    // rises from the bottom edge, as everything that opens on a phone
    animation: "z-sheet-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    _motionReduce: { animation: "none" },
  },
});

const Head = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "calc(12px + var(--z-phone-top-gap, 0px)) 8px 0 16px",
    paddingInline: "16px 8px",
    "& h1": { margin: 0, fontSize: "22px", fontWeight: 700, lineHeight: 1.3 },
  },
});

const Close = styled("button", {
  base: {
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "12px",
    background: "none",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Filters = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    gap: "8px",
    padding: "10px 16px",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
});

const Chip = styled("button", {
  base: {
    flex: "none",
    minHeight: "44px",
    paddingInline: "16px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary, var(--z-fg-primary))",
    font: "inherit",
    fontSize: "14px",
    cursor: "pointer",
    // The chosen filter is raised, as the chosen status on the You page and
    // the chosen tab of Friends are: one look for "this one is on" (a white
    // pill here was a fourth way of saying it; owner, 2026-11-17).
    "&[aria-checked='true']": {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-selected)",
      borderColor: "var(--z-border-strong)",
      fontWeight: 600,
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const List = styled("div", {
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    paddingBottom: "16px",
  },
});

const Group = styled("h2", {
  base: {
    margin: 0,
    padding: "10px 16px 4px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/**
 * The rows under one title: one filled group with a hairline between its
 * rows, the look of the settings list (design pack, 2026-11-17)
 */
const Rows = styled("div", {
  base: {
    marginInline: "12px",
    borderRadius: "14px",
    overflow: "hidden",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    "& > * + *": {
      borderTop: "1px solid var(--z-float-divider, var(--z-border-subtle))",
    },
  },
});

const rowStyle = {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    width: "100%",
    padding: "12px 14px",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    "&[type='button']": { cursor: "pointer" },
    // not opened yet: a light wash of the action colour
    "&[data-new]": {
      background: "color-mix(in srgb, var(--z-accent) 7%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
} as const;

/** A friend request: who sent it, then the answers under the words */
const Request = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    paddingBlockEnd: "12px",
    "&[data-new]": {
      background: "color-mix(in srgb, var(--z-accent) 7%, transparent)",
    },
  },
});

/** The sender's picture and the sentence: one target that opens the profile */
const Who = styled("button", {
  base: {
    ...rowStyle.base,
    minHeight: "44px",
    paddingBlockEnd: 0,
    cursor: "pointer",
  },
});

/** A row that opens what it shows */
const RowButton = styled("button", rowStyle);

const Text = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    "& p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: 1.5,
      color: "var(--z-fg-secondary, var(--z-fg-primary))",
      overflowWrap: "anywhere",
    },
    "& strong": { fontWeight: 600, color: "var(--z-fg-primary)" },
  },
});

/** The message's own words, marked as a quote by the line beside them */
const Quote = styled("div", {
  base: {
    marginTop: "6px",
    paddingInlineStart: "10px",
    borderInlineStart:
      "3px solid var(--z-border-strong, var(--z-border-subtle))",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    lineClamp: 2,
    overflowWrap: "anywhere",
  },
});

const When = styled("span", {
  base: {
    flex: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    paddingTop: "3px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Dot = styled("span", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--z-accent)",
  },
});

const Answers = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
    // under the words, past the 44 px picture and the 12 px gap
    "&[data-request]": { paddingInline: "70px 14px" },
  },
});

const Answer = styled("button", {
  base: {
    minHeight: "44px",
    paddingInline: "14px",
    border: "none",
    borderRadius: "10px",
    background: "var(--z-bg-input, var(--z-bg-raised))",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "&[data-primary]": {
      color: "var(--z-on-accent, #FFFFFF)",
      background: "var(--z-accent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Center = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "48px 24px",
    textAlign: "center",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});
