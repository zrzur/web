import {
  type JSX,
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createResource,
  lazy,
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
import { shortcutFor } from "@revolt/keybinds/active";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Avatar, CircularProgress, Time, useSnackbar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

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
 * by one of your roles, or with @everyone / @here) in channels you can see.
 * Select one to jump to it. Opens as a small box on wide screens and as a
 * sheet on phones.
 *
 * Mentions
 * The last 30 days. Select one to jump to it.
 * [avatar] Name  Server · #channel · 1h
 *          preview of the message…
 */
export function MentionsPanel(props: InboxPanelProps) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const [mentions] = createResource(() => client().fetchMentions(50));
  // these come from many channels: they stay in the message cache while
  // the box is open
  onCleanup(
    // read when the cache is looked through, not tracked
    // eslint-disable-next-line solid/reactivity
    holdMessages(() =>
      mentions.state === "ready" ? mentions().map((message) => message.id) : [],
    ),
  );

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

  const open = (message: Message) => {
    navigate(message.path);
    props.onNavigate?.();
  };

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
        <p>
          <Trans>The last 30 days. Select one to jump to it.</Trans>
        </p>
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
            <For each={mentions()}>
              {(message) => (
                <Item type="button" onClick={() => open(message)}>
                  <Avatar
                    size={36}
                    src={message.animatedAvatarURL}
                    fallback={message.username}
                  />
                  <Body>
                    <Line>
                      <strong
                        dir="auto"
                        style={{ color: message.roleColour ?? undefined }}
                      >
                        {message.username}
                      </strong>
                      <When>
                        <Time format="relative" value={message.createdAt} />
                      </When>
                    </Line>
                    <Where>
                      <For each={place(message)}>
                        {(part, index) => (
                          <>
                            {index() > 0 ? " · " : ""}
                            <bdi>{part}</bdi>
                          </>
                        )}
                      </For>
                    </Where>
                    <Preview>
                      <bdi>{client().markdownToText(message.content)}</bdi>
                    </Preview>
                  </Body>
                </Item>
              )}
            </For>
          </Match>
        </Switch>
      </List>
    </Panel>
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
    gap: "8px",
    // phones: entries touch, as one group (InboxEntry); the mentions use
    // their own page there
    _phone: { paddingInline: "4px", gap: 0 },
  },
});

/** One mention, in its own box */
export const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    width: "100%",
    flexShrink: 0,
    padding: "12px",
    border: "1px solid var(--z-card-border, var(--z-border-soft))",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    background: "var(--z-card-bg)",
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
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

export const Preview = styled("p", {
  base: {
    margin: "4px 0 0",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    lineClamp: 3,
    overflowWrap: "anywhere",
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
