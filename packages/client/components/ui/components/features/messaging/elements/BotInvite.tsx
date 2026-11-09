import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { PublicBot } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { BotLabel } from "../../profiles/BotLabel";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Avatar, Button } from "@revolt/ui/components/design";

interface Props {
  /**
   * Bot ID
   */
  id: string;

  /**
   * Permissions the link asks for on a server
   */
  permissions?: number;
}

/**
 * Card for a bot invite link posted in chat
 */
export function BotInvite(props: Props) {
  const client = useClient();
  const { openModal } = useModals();

  const query = useQuery(() => ({
    queryKey: ["bot-invite", props.id],
    queryFn: () =>
      client()
        .api.get(`/bots/${props.id as ""}/invite`)
        .then((invite) => new PublicBot(client(), invite)),

    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  }));

  return (
    <Base>
      <Avatar
        size={48}
        src={
          query.data?.avatar?.previewUrl ??
          `${client().options.baseURL}/users/${props.id}/default_avatar`
        }
        fallback={query.data?.username}
      />
      <Info>
        <Name>
          <span>
            <Show when={query.data} fallback={<Trans>Bot</Trans>}>
              {query.data!.username}
            </Show>
          </span>
          <BotLabel verified={query.data?.verified} />
        </Name>
        <Line>
          <Show
            when={!query.isError}
            fallback={<Trans>This bot is private or no longer exists.</Trans>}
          >
            <Show
              when={query.data?.description}
              fallback={<Trans>Add this bot to a server or group.</Trans>}
            >
              {query.data!.description}
            </Show>
          </Show>
        </Line>
      </Info>
      <div class={addButton}>
        <Button
          isDisabled={!query.data}
          onPress={() =>
            openModal({
              type: "add_bot",
              invite: query.data!,
              permissions: props.permissions,
            })
          }
        >
          <Trans>Add bot</Trans>
        </Button>
      </div>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",

    maxWidth: "420px",
    marginBlock: "4px",
    padding: "12px 16px",
    borderRadius: "12px",

    background: "var(--z-card-bg, #1D1F2D)",
    border: "1px solid var(--z-border-subtle, rgba(255,255,255,0.08))",
  },
});

const addButton = css({ flexShrink: 0, marginInlineStart: "auto" });

const Info = styled("div", {
  base: {
    // narrow chats: the button moves below instead of squeezing the text
    flex: "1 1 200px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const Name = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 600,
    color: "var(--z-fg-primary, #F2F3F8)",

    "& > span:first-child": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Line = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted, #979BB1)",
    lineClamp: 2,
  },
});
