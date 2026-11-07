import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar, CircularProgress, Time } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

const [open, setOpen] = createSignal(false);

/** Open the mentions box (from the account card or the phone tab) */
export const openMentions = () => setOpen(true);

/**
 * Where the mentions box appears: in the middle of the window on wide
 * screens, a sheet from the bottom on phones. Mounted once.
 */
export function MentionsHost() {
  const { t } = useLingui();

  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    onCleanup(() => document.removeEventListener("keydown", onKey, true));
  });

  return (
    <Show when={open()}>
      <Portal mount={document.getElementById("floating")!}>
        <Scrim onClick={() => setOpen(false)} />
        <Frame role="dialog" aria-modal="true" aria-label={t`Mentions`}>
          <MentionsPanel onNavigate={() => setOpen(false)} />
        </Frame>
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
export function MentionsPanel(props: { onNavigate?: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const [mentions] = createResource(() => client().fetchMentions(50));

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
        <h2>
          <Trans>Mentions</Trans>
        </h2>
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
      bottom: 0,
      left: 0,
      right: 0,
      translate: "none",
      maxHeight: "85dvh",
      display: "flex",
      flexDirection: "column",
      padding: "22px 8px calc(12px + env(safe-area-inset-bottom))",
      borderRadius: "22px 22px 0 0",
      borderTop: "1px solid var(--z-border-strong)",
      background: "var(--z-bg-modal, var(--z-bg-raised))",
    },
  },
});

const Panel = styled("div", {
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

const Head = styled("div", {
  base: {
    paddingInline: "4px",
    paddingBlockEnd: "12px",
    "& h2": { margin: 0, fontSize: "20px", fontWeight: 700 },
    "& p": {
      margin: "4px 0 0",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
    },
  },
});

const List = styled("div", {
  base: {
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    _phone: { paddingInline: "4px" },
  },
});

/** One mention, in its own box */
const Item = styled("button", {
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

const Body = styled("div", {
  base: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const Line = styled("div", {
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

const When = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Where = styled("div", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Preview = styled("p", {
  base: {
    margin: "4px 0 0",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    lineClamp: 3,
    overflowWrap: "anywhere",
  },
});

const Center = styled("div", {
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
