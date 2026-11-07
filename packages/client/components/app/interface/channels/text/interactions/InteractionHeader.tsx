import { onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { floatingUserMenus } from "@revolt/app/menus/UserContextMenu";
import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";

import { interactionState } from "./store";

/**
 * "<user> used /command" above a bot's answer, so every answer says what
 * started it
 */
export function InteractionHeader(props: {
  userId: string;
  /** Command name without the slash */
  name: string;
  serverId?: string;
  /** Bot that answered, to tell slash commands from right-click Apps commands */
  botId?: string;
}) {
  const client = useClient();
  const user = () => client().users.get(props.userId);
  const member = () =>
    props.serverId
      ? client().serverMembers.getByKey({
          server: props.serverId,
          user: props.userId,
        })
      : undefined;

  onMount(() => {
    if (!user())
      client()
        .users.fetch(props.userId)
        .catch(() => {});
  });

  // User and message commands (the Apps menu) are shown without a slash
  const command = () => {
    const list = props.serverId
      ? interactionState.commands[props.serverId]?.commands
      : undefined;
    const app = list?.find(
      (c) => c.application_id === props.botId && c.name === props.name,
    );
    return app && app.type !== "ChatInput" ? props.name : `/${props.name}`;
  };

  const name = () =>
    member()?.nickname ?? user()?.displayName ?? user()?.username ?? "…";

  return (
    <Base data-interaction-header>
      <span
        class={who()}
        use:floating={user() ? floatingUserMenus(user()!, member()) : {}}
      >
        <Avatar src={member()?.avatarURL ?? user()?.avatarURL} size={16} />
        <strong>{name()}</strong>
      </span>
      <Trans>
        used <Command dir="ltr">{command()}</Command>
      </Trans>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    maxHeight: "1.5em",
    overflow: "hidden",
    whiteSpace: "nowrap",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    userSelect: "none",
    "&::before": {
      content: '""',
      display: "block",
      flexShrink: 0,
      width: "22px",
      height: "12px",
      alignSelf: "flex-end",
      marginInlineStart: "30px",
      marginInlineEnd: "2px",
      borderStartStartRadius: "4px",
      borderInlineStart: "2px solid var(--md-sys-color-outline-variant)",
      borderTop: "2px solid var(--md-sys-color-outline-variant)",
    },
  },
});

const who = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
    color: "var(--z-fg-primary)",
    "& strong": { fontWeight: 600 },
    "&:hover strong": { textDecoration: "underline" },
  },
});

const Command = styled("bdi", {
  base: {
    color: "var(--z-link)",
    fontWeight: 500,
  },
});
