import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { startAccess } from "@revolt/app/interface/channels/threadAccess";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Button, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * The threads of a text channel: active ones, or archived ones, and the
 * one action to start a new thread
 */
export function ThreadsPanel(props: { channel: Channel }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const client = useClient();
  const [archived, setArchived] = createSignal(false);
  // inside a thread, the panel shows the threads of the channel it is in
  const channel = () => props.channel.parent ?? props.channel;
  const [threads, { refetch }] = createResource(
    () => [channel(), archived()] as const,
    ([parent, archived]) => parent.fetchThreads({ archived }),
  );

  /** threads known to this session (new ones arrive live), newest first */
  const list = () =>
    client()
      .channels.filter(
        (thread) =>
          thread.parentId === channel().id &&
          !!thread.thread?.archived === archived(),
      )
      .sort((a, b) => b.id.localeCompare(a.id));

  return (
    <Panel>
      <Header>
        <Segmented
          aria-label={t`Threads`}
          value={archived() ? "archived" : "active"}
          onChange={(value) => setArchived(value === "archived")}
          options={[
            { value: "active", label: t`Active` },
            {
              value: "archived",
              label: t`Archived`,
              icon: <Icon name="archive" size={16} />,
            },
          ]}
        />
        <Show when={startAccess(channel()) === "allowed"}>
          <Button
            size="sm"
            variant="tonal"
            onPress={() =>
              openModal({ type: "create_thread", channel: channel() })
            }
          >
            <Icon name="plus" size={16} />
            <Trans>New thread</Trans>
          </Button>
        </Show>
      </Header>

      <Show when={startAccess(channel()) === "switched-off"}>
        <Reason role="note">
          <Trans>
            Threads are off in this server. You can still read the ones it has.
          </Trans>
        </Reason>
      </Show>

      <Switch>
        <Match when={threads.loading && !list().length}>
          <Empty>
            <Trans>Loading…</Trans>
          </Empty>
        </Match>
        <Match when={threads.error}>
          <Empty>
            <Trans>Threads couldn't be loaded.</Trans>
            <Button variant="text" onPress={() => void refetch()}>
              <Trans>Try again</Trans>
            </Button>
          </Empty>
        </Match>
        <Match when={!list().length}>
          <Empty>
            <Icon name="chat-circle" size={28} />
            {archived() ? (
              <Trans>No archived threads.</Trans>
            ) : (
              <Trans>No threads yet. Start one from a message or here.</Trans>
            )}
          </Empty>
        </Match>
        <Match when={list().length}>
          <Rows>
            <For each={list()}>
              {(thread) => (
                <Row
                  type="button"
                  onClick={() =>
                    navigate(`/server/${thread.serverId}/channel/${thread.id}`)
                  }
                >
                  <RowName>
                    <Show when={thread.thread?.locked}>
                      <Icon name="lock-simple" size={14} />
                    </Show>
                    {thread.name}
                  </RowName>
                  <RowMeta>
                    {t`${plural(thread.thread?.messageCount ?? 0, {
                      one: "# message",
                      other: "# messages",
                    })}`}
                  </RowMeta>
                </Row>
              )}
            </For>
          </Rows>
        </Match>
      </Switch>
    </Panel>
  );
}

/** Why nothing new can be started here */
const Reason = styled("p", {
  base: {
    margin: "0 16px 12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
  },
});

/** Active / Archived on one side, the one action on the other */
const Header = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "24px 8px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
  },
});

const Rows = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "4px" },
});

const Row = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    minHeight: "44px",
    padding: "8px 12px",
    border: "none",
    borderRadius: "var(--z-radius-md)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    cursor: "pointer",
    _hover: { background: "var(--z-bg-raised)" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
  },
});

const RowName = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 600,
    fontSize: "14px",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const RowMeta = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-secondary)" },
});
