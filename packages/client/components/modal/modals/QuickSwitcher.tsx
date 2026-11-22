import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel, Server, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { conversationName } from "@revolt/app/interface/channels/conversationName";
import { useClient } from "@revolt/client";
import {
  type SwitchItem,
  rankItems,
  recentPlaces,
  stepSelection,
} from "@revolt/keybinds/quickSwitch";
import { useNavigate } from "@revolt/routing";
import { Avatar, Badge, Dialog, DialogProps, TextField } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

/** A result and what it opens */
type Entry = SwitchItem & {
  avatar?: string;
  voice?: boolean;
  open: () => void | Promise<void>;
};

/**
 * Ctrl+K (⌘K on a Mac): jump to a channel, a conversation, a server or a
 * friend by name. Recent places first; ↑ ↓ choose, Enter opens, Esc closes.
 * Listed in Ctrl+/.
 */
export function QuickSwitcherModal(
  props: DialogProps & Modals & { type: "quick_switcher" },
) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();

  const [query, setQuery] = createSignal("");
  const [at, setAt] = createSignal(0);
  const recents = recentPlaces();

  const entries = createMemo<Entry[]>(() => {
    const list: Entry[] = [];
    const withConversation = new Set<string>();

    for (const channel of client().channels.toList() as Channel[]) {
      const base = {
        id: channel.id,
        unread: !!channel.unread,
        mentions: channel.mentions?.size ?? 0,
        updatedAt: channel.updatedAt?.getTime?.() ?? 0,
      };
      switch (channel.type) {
        case "TextChannel":
          if (!channel.server) break;
          list.push({
            ...base,
            kind: "channel",
            name: channel.name ?? "",
            place: channel.server.name,
            voice: channel.isVoice,
            open: () =>
              navigate(`/server/${channel.serverId}/channel/${channel.id}`),
          });
          break;
        case "DirectMessage":
          if (!channel.active) break;
          if (channel.recipient) withConversation.add(channel.recipient.id);
          list.push({
            ...base,
            kind: "conversation",
            name: conversationName(channel) ?? "",
            place: t`Direct message`,
            avatar: channel.recipient?.animatedAvatarURL,
            open: () => navigate(`/channel/${channel.id}`),
          });
          break;
        case "Group":
          list.push({
            ...base,
            kind: "conversation",
            name: conversationName(channel) ?? "",
            place: t`Group`,
            avatar: channel.iconURL,
            open: () => navigate(`/channel/${channel.id}`),
          });
          break;
        case "SavedMessages":
          list.push({
            ...base,
            kind: "conversation",
            name: t`Saved notes`,
            place: t`Only you`,
            avatar: channel.user?.animatedAvatarURL,
            open: () => navigate(`/channel/${channel.id}`),
          });
          break;
      }
    }

    for (const server of client().servers.toList() as Server[])
      list.push({
        kind: "server",
        id: server.id,
        name: server.name,
        place: t`Server`,
        unread: !!server.unread,
        mentions: server.mentions?.length ?? 0,
        updatedAt: 0,
        avatar: server.iconURL,
        open: () => navigate(`/server/${server.id}`),
      });

    // friends without an open conversation: choosing one opens it
    for (const user of client().users.toList() as User[])
      if (user.relationship === "Friend" && !withConversation.has(user.id))
        list.push({
          kind: "friend",
          id: user.id,
          name: user.displayName ?? user.username,
          place: t`Friend`,
          unread: false,
          mentions: 0,
          updatedAt: 0,
          avatar: user.animatedAvatarURL,
          open: async () => {
            const dm = await user.openDM();
            navigate(`/channel/${dm.id}`);
          },
        });

    return list;
  });

  const results = createMemo(
    () => rankItems(entries(), query(), recents) as Entry[],
  );

  const selected = () => results()[at()];

  function choose(entry: Entry | undefined) {
    if (!entry) return;
    props.onClose();
    void entry.open();
  }

  function onKey(event: KeyboardEvent) {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = stepSelection(
        results().length,
        at(),
        event.key === "ArrowDown" ? 1 : -1,
      );
      setAt(next);
      const entry = results()[next];
      if (entry)
        document
          .getElementById(`switch-${entry.id}`)
          ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(selected());
    }
  }

  return (
    <Dialog
      tone="info"
      iconName="magnifying-glass"
      size="md"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Go to</Trans>}
      description={
        <Trans>Start with # for channels, @ for people or * for servers.</Trans>
      }
    >
      <Fields data-testid="quick-switcher">
        <TextField
          type="search"
          variant="filled"
          autoFocus
          value={query()}
          label={t`Search`}
          placeholder={t`Channels, conversations, servers and friends`}
          aria-controls="switch-results"
          aria-activedescendant={
            selected() ? `switch-${selected()!.id}` : undefined
          }
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setAt(0);
          }}
          onKeyDown={onKey}
        />

        <Results
          id="switch-results"
          role="listbox"
          aria-label={query().trim() ? t`Results` : t`Recent and unread places`}
        >
          <For
            each={results()}
            fallback={
              <Empty>
                <Trans>Nothing found. Try another name.</Trans>
              </Empty>
            }
          >
            {(entry, index) => (
              <Option
                id={`switch-${entry.id}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index() === at()}
                data-kind={entry.kind}
                onMouseMove={() => setAt(index())}
                onClick={() => choose(entry)}
              >
                <Switch
                  fallback={
                    <Avatar
                      size={32}
                      src={entry.avatar}
                      fallback={entry.name}
                    />
                  }
                >
                  <Match when={entry.kind === "channel"}>
                    <Mark aria-hidden="true">
                      <Icon
                        name={entry.voice ? "speaker-high" : "hash"}
                        size={20}
                      />
                    </Mark>
                  </Match>
                </Switch>
                <Text>
                  <Name>
                    <bdi>{entry.name}</bdi>
                  </Name>
                  <Show when={entry.place}>
                    <Place>
                      <bdi>{entry.place}</bdi>
                    </Place>
                  </Show>
                </Text>
                <Switch>
                  <Match when={entry.mentions > 0}>
                    <span
                      aria-label={t`${plural(entry.mentions, {
                        one: "# mention",
                        other: "# mentions",
                      })}`}
                      role="img"
                    >
                      <Badge variant="large">{entry.mentions}</Badge>
                    </span>
                  </Match>
                  <Match when={entry.unread}>
                    <Dot role="img" aria-label={t`Unread`} />
                  </Match>
                </Switch>
              </Option>
            )}
          </For>
        </Results>
      </Fields>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Results = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "360px",
    overflowY: "auto",
    minWidth: 0,
    _phone: { maxHeight: "55vh" },
  },
});

const Option = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    paddingBlock: "8px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "var(--z-radius-sm)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    minWidth: 0,
    "--z-icon-color": "var(--z-icon-muted)",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    "&[aria-selected='true']": {
      background: "var(--z-nav-selected)",
      boxShadow: "inset 0 0 0 2px var(--z-accent)",
      "--z-icon-color": "var(--z-accent)",
    },
  },
});

const Mark = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "32px",
    height: "32px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--z-bg-raised)",
  },
});

const Text = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
});

const Name = styled("span", {
  base: {
    fontSize: "15px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "start",
  },
});

const Place = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "start",
  },
});

const Dot = styled("span", {
  base: {
    flexShrink: 0,
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "var(--z-fg-primary)",
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "12px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});
