import { lazy } from "@revolt/common/lib/lazyPart";
import {
  type JSX,
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  type InboxView,
  closeInbox,
  inboxOpen,
  inboxView,
  openInbox,
  setInboxView,
} from "@revolt/app/interface/saved/inboxView";
import { savedRemindersEnabled } from "@revolt/app/interface/saved/savedModel";
import {
  type Reminder,
  attachReminders,
} from "@revolt/app/interface/saved/savedStore";
import { TextTabs } from "@revolt/app/interface/settings/SettingsTabs";
import { useClient } from "@revolt/client";
import { holdMessages } from "@revolt/client/messagePruner";

import { useDevice } from "@revolt/common";
import { backCloses } from "@revolt/common/lib/backCloses";
import { useTime } from "@revolt/i18n";
import { shortcutFor } from "@revolt/keybinds/active";
import { renderSimpleMarkdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Avatar, CircularProgress, Time, useSnackbar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { mentionsList } from "./mentionsCache";

// phones only, and only once it is opened: kept out of the files the app
// installs up front (scripts/precacheShell.mjs)
const NotificationsPhone = lazy(() =>
  import("./NotificationsPhone").then((m) => ({
    default: m.NotificationsPhone,
  })),
);

// opened from a message's menu, the You page or a shortcut: kept out of the
// first download like the phone page
const SavedPanel = lazy(() =>
  import("./SavedPanel").then((m) => ({ default: m.SavedPanel })),
);
const RemindersPanel = lazy(() =>
  import("./RemindersPanel").then((m) => ({ default: m.RemindersPanel })),
);

const open = inboxOpen;
const view = inboxView;
const setView = setInboxView;

/** Open the mentions box (from the account card or the phone tab) */
export const openMentions = () => openInbox("mentions");

/** What a list in the box gets from the box */
export type InboxPanelProps = {
  /**
   * Wide screens: the switch between the lists. The tabs name the lists,
   * so they take the place of the title (as the tabs of Settings do).
   */
  tabs?: JSX.Element;
  /** Phones: the sheet has a close button */
  onClose?: () => void;
  onNavigate?: () => void;
};

/**
 * Where the mentions box appears: in the middle of the window on wide
 * screens, a sheet from the bottom on phones. Mounted once.
 */
export function MentionsHost() {
  const { t } = useLingui();
  const device = useDevice();
  const client = useClient();
  const navigate = useNavigate();
  const modals = useModals();
  const snackbar = useSnackbar();
  const app = useState();
  const phone = () => device.layout() === "phone";
  /** saving and reminders are on for this server */
  const more = () => savedRemindersEnabled(client());
  const shown = (): InboxView => (more() ? view() : "mentions");
  const close = closeInbox;

  // phones: Back closes the notifications page
  backCloses(open, close);

  // a reminder that comes due while the app is open: a notice with a way
  // to the message, and a system notification when the window is hidden
  const onDue = (reminder: Reminder, message: Message | undefined) => {
    const text = message
      ? t`Reminder: ${client().markdownToText(message.content).slice(0, 80)}`
      : t`A reminder is due, but its message is no longer available.`;
    const go = () => {
      if (message) {
        navigate(message.path);
        // phones: the lists and the conversation share the screen
        app.appDrawer()?.setShown(true);
        close();
      } else openInbox("reminders");
    };
    snackbar.show({
      message: text,
      messageLine: 2,
      action: message ? t`Open message` : t`Show reminders`,
      onAction: go,
      closeable: true,
      closeOnAction: true,
    });
    if (
      document.hidden &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        const notice = new Notification(t`Reminder`, {
          body: message
            ? client().markdownToText(message.content).slice(0, 200)
            : text,
          tag: `reminder-${reminder._id}`,
        });
        notice.onclick = () => {
          window.focus();
          go();
        };
      } catch {
        // phones only allow notifications from the service worker: the
        // notice in the app is enough here
      }
    }
  };
  createEffect(() => {
    if (more()) attachReminders(client(), onDue);
  });

  // Ctrl+Shift+2 mentions, Ctrl+Shift+4 saved, Ctrl+Shift+5 reminders
  // (changeable in Ctrl+/)
  const onShortcut = (event: KeyboardEvent) => {
    const id = shortcutFor(event);
    if (id === "view_mentions") {
      if (modals.isOpen()) return;
      event.preventDefault();
      openInbox("mentions");
      return;
    }
    if (id !== "view_saved" && id !== "view_reminders") return;
    if (!more() || modals.isOpen()) return;
    event.preventDefault();
    openInbox(id === "view_saved" ? "saved" : "reminders");
  };
  document.addEventListener("keydown", onShortcut);
  onCleanup(() => document.removeEventListener("keydown", onShortcut));

  const label = () =>
    shown() === "saved"
      ? t`Saved messages`
      : shown() === "reminders"
        ? t`Reminders`
        : t`Mentions`;

  /**
   * wide screens: the three lists side by side, in the text tabs of
   * Settings (a boxed switch here looked pasted on; owner, 2026-11-19)
   */
  const tabs = () =>
    more() && !phone() ? (
      <TextTabs<InboxView>
        label={t`Lists`}
        value={shown()}
        onChange={setView}
        tabs={[
          { id: "mentions", label: <Trans>Mentions</Trans> },
          { id: "saved", label: <Trans>Saved list</Trans> },
          { id: "reminders", label: <Trans>Reminders</Trans> },
        ]}
      />
    ) : undefined;

  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => {
      // a dialog opened from a list (Remind me) closes first
      if (e.key === "Escape" && !modals.isOpen()) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    onCleanup(() => document.removeEventListener("keydown", onKey, true));
  });

  return (
    <Show when={open()}>
      <Portal mount={document.getElementById("floating")!}>
        {/* phones: a whole page, with friend requests as well */}
        <Show
          when={phone() && shown() === "mentions"}
          fallback={
            <>
              <Scrim onClick={close} />
              <Frame role="dialog" aria-modal="true" aria-label={label()}>
                <Suspense>
                  <Switch>
                    <Match when={shown() === "saved"}>
                      <SavedPanel
                        tabs={tabs()}
                        onNavigate={close}
                        onClose={phone() ? close : undefined}
                      />
                    </Match>
                    <Match when={shown() === "reminders"}>
                      <RemindersPanel
                        tabs={tabs()}
                        onNavigate={close}
                        onClose={phone() ? close : undefined}
                      />
                    </Match>
                    <Match when={shown() === "mentions"}>
                      <MentionsPanel tabs={tabs()} onNavigate={close} />
                    </Match>
                  </Switch>
                </Suspense>
              </Frame>
            </>
          }
        >
          <Suspense>
            <NotificationsPhone onClose={close} />
          </Suspense>
        </Show>
      </Portal>
    </Show>
  );
}

/**
 * Mentions inbox: messages from the last 30 days that mention you (by name,
 * by one of your roles, or with @everyone / @here) in channels you can see,
 * by day, newest first. Select one to jump to it.
 *
 * Today
 * [avatar] Name                          14:30
 *          Server · #channel     @everyone
 *          the message, as it reads in the chat…
 */
export function MentionsPanel(props: InboxPanelProps) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const dayjs = useTime();
  // the last list at once, refreshed behind it
  const mentions = mentionsList(client());
  // these come from many channels: they stay in the message cache while
  // the box is open
  onCleanup(
    // read when the cache is looked through, not tracked
    holdMessages(() => (mentions() ?? []).map((message) => message.id)),
  );

  /** the day a mention is under: Today, Yesterday, or its date */
  const dayOf = (date: Date) => {
    const day = dayjs(date).startOf("day");
    const today = dayjs().startOf("day");
    if (day.isSame(today)) return t`Today`;
    if (day.isSame(today.subtract(1, "day"))) return t`Yesterday`;
    return day.format("LL");
  };
  const days = createMemo(() => {
    // a day, then one box per person and place: their mentions one after
    // the other (name and place said once, at the top of the box)
    const groups: { label: string; bundles: Message[][] }[] = [];
    for (const message of mentions() ?? []) {
      const label = dayOf(message.createdAt);
      let day = groups.at(-1);
      if (day?.label !== label) {
        day = { label, bundles: [] };
        groups.push(day);
      }
      const bundle = day.bundles.at(-1);
      const before = bundle?.at(-1);
      if (
        bundle &&
        before &&
        before.authorId === message.authorId &&
        before.channelId === message.channelId
      )
        bundle.push(message);
      else day.bundles.push([message]);
    }
    // inside a box the words read as in the chat, oldest first (a reply
    // under what it answers); the boxes stay newest first
    for (const day of groups)
      day.bundles = day.bundles.map((bundle) => bundle.toReversed());
    return groups;
  });

  return (
    <Panel>
      <Head>
        <Show
          when={props.tabs}
          fallback={
            <h2>
              <Trans>Mentions</Trans>
            </h2>
          }
        >
          {props.tabs}
        </Show>
      </Head>
      <List>
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
          <Match when={!mentions()?.length}>
            <Center role="status">
              <Icon name="at" size={22} />
              <Trans>No mentions in the last 30 days.</Trans>
            </Center>
          </Match>
          <Match when={mentions()}>
            <For each={days()}>
              {(day) => (
                <Day>
                  <DayLabel>{day.label}</DayLabel>
                  <For each={day.bundles}>
                    {(bundle) => (
                      <Bundle>
                        <For each={bundle}>
                          {(message, index) => (
                            <MessageRow
                              message={message}
                              more={index() > 0}
                              note={
                                <Time format="time" value={message.createdAt} />
                              }
                              how={<MentionKind message={message} />}
                              onOpen={(m) => {
                                navigate(m.path);
                                props.onNavigate?.();
                              }}
                            />
                          )}
                        </For>
                      </Bundle>
                    )}
                  </For>
                </Day>
              )}
            </For>
          </Match>
        </Switch>
      </List>
    </Panel>
  );
}

/** Server and channel apart: an Arabic name beside a Latin one must not
 * swap their order */
export function usePlace() {
  const { t } = useLingui();
  return (message: Message): string[] => {
    const channel = message.channel;
    if (!channel) return [];
    if (channel.type === "DirectMessage") return [t`Direct message`];
    const name =
      channel.type === "SavedMessages" ? t`Saved notes` : `#${channel.name}`;
    return channel.server ? [channel.server.name, name] : [name];
  };
}

/**
 * The words of a message as they read in the chat: mentions, emoji and
 * formatting drawn, nothing in it clickable (the row opens the message).
 * Its own direction: an Arabic line reads right to left beside an English
 * name.
 */
export function MessagePreview(props: { content: string }) {
  return (
    <Preview dir="auto" data-preview>
      {renderSimpleMarkdown(props.content)}
    </Preview>
  );
}

/**
 * How a mention reached you, when it was not by your name: @everyone,
 * @here or one of your roles
 */
function MentionKind(props: { message: Message }) {
  const client = useClient();
  const byName = () =>
    !!props.message.mentionIds?.includes(client().user?.id ?? "");
  const role = () => props.message.roleMentions?.find((r) => r.assigned);
  return (
    <Show when={!byName()}>
      <Switch>
        <Match when={props.message.mentionsEveryone}>
          <Kind>@everyone</Kind>
        </Match>
        <Match when={props.message.mentionsOnline}>
          <Kind>@here</Kind>
        </Match>
        <Match when={role()}>
          {(r) => (
            <Kind style={{ color: r().colour ?? undefined }}>
              <bdi>@{r().name}</bdi>
            </Kind>
          )}
        </Match>
      </Switch>
    </Show>
  );
}

/**
 * One message in a list of the box: who wrote it and where, with a time
 * (or another note) at the end, and its words. The whole row opens it.
 */
export function MessageRow(props: {
  message: Message;
  note?: JSX.Element;
  /** beside where it is: how it reached you */
  how?: JSX.Element;
  /** the same person, in the same place, as the row above: words only */
  more?: boolean;
  onOpen: (message: Message) => void;
}) {
  const place = usePlace();
  return (
    <Item
      type="button"
      data-more={props.more || undefined}
      onClick={() => props.onOpen(props.message)}
    >
      <Show
        when={!props.more}
        fallback={
          <>
            {/* where the avatar is: the time, shown on the line you point
                at (as the chat does) */}
            <span class="gap">{props.note}</span>
            <Body>
              <Show when={props.message.content}>
                <MessagePreview content={props.message.content} />
              </Show>
              {props.how}
            </Body>
          </>
        }
      >
        <Avatar
          size={36}
          src={props.message.animatedAvatarURL}
          fallback={props.message.username}
        />
        <Body>
          <Line>
            <strong
              dir="auto"
              style={{ color: props.message.roleColour ?? undefined }}
            >
              {props.message.username}
            </strong>
            <Show when={props.note}>
              <When>{props.note}</When>
            </Show>
          </Line>
          <Where>
            <span class="place">
              <For each={place(props.message)}>
                {(part, index) => (
                  <>
                    {index() > 0 ? " · " : ""}
                    <bdi>{part}</bdi>
                  </>
                )}
              </For>
            </span>
            {props.how}
          </Where>
          <Show when={props.message.content}>
            <MessagePreview content={props.message.content} />
          </Show>
        </Body>
      </Show>
    </Item>
  );
}

const Scrim = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    bottom: "var(--z-screen-bottom, 0px)",
    zIndex: 998,
    background: "rgb(6 8 12 / 0.35)",
    _phone: { background: "var(--z-scrim, rgb(6 8 12 / 0.6))" },
  },
});

/** In the middle of the window on wide screens; a bottom sheet on phones */
const Frame = styled("div", {
  base: {
    position: "fixed",
    zIndex: 999,
    // the middle of the window
    top: "50%",
    left: "50%",
    translate: "-50% -50%",
    _phone: {
      top: "auto",
      bottom: "var(--z-screen-bottom, 0px)",
      left: 0,
      right: 0,
      translate: "none",
      maxHeight: "85dvh",
      display: "flex",
      flexDirection: "column",
      padding: "22px 8px calc(12px + var(--z-safe-bottom))",
      borderRadius: "22px 22px 0 0",
      borderTop: "1px solid var(--z-border-strong)",
      background: "var(--z-bg-modal, var(--z-bg-raised))",
    },
  },
});

export const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    width: "min(480px, calc(100vw - 24px))",
    maxHeight: "min(560px, calc(100dvh - 120px))",
    padding: "16px 12px 12px",
    borderRadius: "16px",
    border: "1px solid var(--z-border-strong)",
    background: "var(--z-bg-modal, var(--z-bg-raised))",
    boxShadow:
      "0 24px 60px -18px rgb(0 0 0 / 0.65), 0 2px 6px rgb(0 0 0 / 0.25)",
    color: "var(--z-fg-primary)",
    // with the tabs the box keeps one height, so it does not jump in the
    // middle of the window when a shorter list is chosen
    "&:has([role='tablist'])": {
      height: "min(560px, calc(100dvh - 120px))",
    },
    // phones: the sheet is the frame
    _phone: {
      width: "100%",
      maxHeight: "none",
      padding: 0,
      border: "none",
      background: "none",
      boxShadow: "none",
      flex: "1 1 auto",
      minHeight: 0,
    },
  },
});

export const Head = styled("div", {
  base: {
    paddingInline: "4px",
    paddingBlockEnd: "12px",
    "& h2": { margin: 0, fontSize: "20px", fontWeight: 700 },
    "& p": {
      margin: "4px 0 0",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
    },
    // the tabs in place of the title: the line under them leaves room
    "& [role='tablist'] + p, & [role='tablist'] + div": {
      marginBlockStart: "12px",
    },
  },
});

export const List = styled("div", {
  base: {
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    // phones: entries touch, as one group (InboxEntry); the mentions use
    // their own page there
    _phone: { paddingInline: "4px", gap: 0 },
  },
});

/** One message: a row of the list, lit where the pointer is */
export const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    width: "100%",
    flexShrink: 0,
    position: "relative",
    padding: "10px 12px",
    border: "none",
    borderRadius: "var(--z-radius-md, 12px)",
    background: "transparent",
    // a following message of the same box: its words under the first's,
    // its time where the avatar is, on the line you point at
    "&[data-more]": { paddingBlock: "4px 8px" },
    "&[data-more] .gap": {
      width: "36px",
      flexShrink: 0,
      paddingBlockStart: "2px",
      fontSize: "11px",
      lineHeight: "18px",
      whiteSpace: "nowrap",
      textAlign: "center",
      color: "var(--z-fg-muted)",
      opacity: 0,
    },
    "&[data-more]:hover .gap": { opacity: 1 },
    "&[data-more]:focus-visible .gap": { opacity: 1 },
    "&[data-more] [data-preview]": { margin: 0 },
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _active: { background: "var(--z-nav-selected)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

export const Body = styled("div", {
  base: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

export const Line = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    "& strong": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "15px",
      fontWeight: 600,
    },
  },
});

export const When = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

export const Where = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    "& .place": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

export const Preview = styled("div", {
  base: {
    margin: "4px 0 0",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    lineClamp: 2,
    overflowWrap: "anywhere",
    textAlign: "start",
    // drawn, never clicked: the row opens the message
    pointerEvents: "none",
  },
});

/** One person's mentions in one place, one after the other: one box */
const Bundle = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--z-radius-md, 12px)",
    background: "var(--z-box-bg)",
    overflow: "hidden",
    // the line under the pointer lights up, inside the box
    "& > button": { borderRadius: 0 },
  },
});

/** One day of mentions */
const Day = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    "& + &": { marginBlockStart: "12px" },
  },
});

/** Today, Yesterday or the date, above that day's mentions */
const DayLabel = styled("h3", {
  base: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    margin: 0,
    padding: "6px 12px 4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    background: "var(--z-bg-modal, var(--z-bg-raised))",
    _phone: { background: "var(--z-bg-nav)" },
  },
});

/** How a mention reached you (@everyone, @here, a role) */
const Kind = styled("span", {
  base: {
    flexShrink: 0,
    paddingInline: "6px",
    borderRadius: "999px",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: "18px",
  },
});

export const Center = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "36px 16px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});
