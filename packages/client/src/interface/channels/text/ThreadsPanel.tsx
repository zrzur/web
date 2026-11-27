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
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Button, LineTabs } from "@revolt/ui";
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
  const device = useDevice();
  const phone = () => device.layout() === "phone";
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
      {/* one row: which threads, and the one action */}
      <Header>
        <LineTabs
          aria-label={t`Threads`}
          value={archived() ? "archived" : "active"}
          onChange={(value) => setArchived(value === "archived")}
          options={[
            { value: "active", label: t`Active` },
            { value: "archived", label: t`Archived` },
          ]}
        />
        <Show when={startAccess(channel()) === "allowed"}>
          <NewThread
            type="button"
            aria-label={t`New thread`}
            title={t`New thread`}
            onClick={() =>
              openModal({ type: "create_thread", channel: channel() })
            }
          >
            <Icon name="plus" size={18} />
          </NewThread>
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
          <Empty data-empty="threads">
            <Icon name="chat-circle" size={28} />
            <Show
              when={phone()}
              fallback={
                <span>
                  {archived() ? (
                    <Trans>No archived threads.</Trans>
                  ) : (
                    <Trans>
                      No threads yet. Start one from a message or here.
                    </Trans>
                  )}
                </span>
              }
            >
              <b>
                {archived() ? (
                  <Trans>No archived threads</Trans>
                ) : (
                  <Trans>No threads yet</Trans>
                )}
              </b>
              <span>
                {archived() ? (
                  <Trans>Threads that were archived show here.</Trans>
                ) : (
                  <Trans>Start one from a message or with +.</Trans>
                )}
              </span>
            </Show>
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
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    border: "var(--z-box-border)",
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    // phones: the panel fills the tab, so its empty state can sit in the
    // middle of the free room
    _phone: { flex: 1, minHeight: 0, padding: "4px" },
  },
});

/** Active / Archived on one side, the one action on the other: one row */
const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    borderBottom: "1px solid var(--z-border-soft, var(--z-divider))",
    // phones: the panel sits on the screen's edge, the row keeps its air
    _phone: { paddingInline: "12px" },
  },
});

/** Start a thread: a small square button, its name in its tooltip */
const NewThread = styled("button", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    marginBottom: "3px",
    padding: 0,
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    _hover: {
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-primary)",
    },
    _active: { opacity: 0.85 },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
    },
    _phone: { width: "44px", height: "44px", marginBottom: 0 },
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
    // phones: the one empty state of the details screen: a large quiet
    // icon and the words, in the middle of the free room
    _phone: {
      flex: 1,
      justifyContent: "center",
      padding: "48px 32px",
      lineHeight: "22px",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "var(--z-icon-muted)",
      "& svg": { width: "44px", height: "44px", marginBlockEnd: "8px" },
      "& b": {
        fontSize: "18px",
        fontWeight: 600,
        color: "var(--z-fg-primary)",
      },
    },
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
