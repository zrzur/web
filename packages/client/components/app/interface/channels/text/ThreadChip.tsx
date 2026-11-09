import { Show } from "solid-js";

import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/solid/macro";
import { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { findThread } from "@revolt/client/threads";
import { useNavigate } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Under a message that started a thread: the thread's name and how many
 * messages it has; opens the thread
 */
export function ThreadChip(props: { message: Message }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const client = useClient();
  // from the client's thread index: searching every channel for each
  // message made opening a channel slow
  const thread = () =>
    findThread(client().channels, props.message.channelId, props.message.id);

  return (
    <Show when={thread()}>
      {(thread) => (
        <Chip
          type="button"
          onClick={() =>
            navigate(`/server/${thread().serverId}/channel/${thread().id}`)
          }
        >
          <Icon name="chat-circle" size={16} />
          <Name>{thread().name}</Name>
          <Count>
            {t`${plural(thread().thread?.messageCount ?? 0, {
              one: "# message",
              other: "# messages",
            })}`}
          </Count>
          <Show when={thread().thread?.archived}>
            <Count>· {t`archived`}</Count>
          </Show>
        </Chip>
      )}
    </Show>
  );
}

const Chip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "100%",
    marginBlockStart: "4px",
    minHeight: "32px",
    padding: "4px 12px",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-link, currentColor)",
    cursor: "pointer",
    textAlign: "start",
    _hover: { background: "var(--z-slate-1, var(--z-bg-raised))" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Name = styled("span", {
  base: {
    fontWeight: 600,
    fontSize: "14px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Count = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-secondary)", flexShrink: 0 },
});
