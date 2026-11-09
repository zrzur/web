import { For, JSX, Match, Show, Switch, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { type API, MessageEmbed } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { useClient } from "@revolt/client";
import { Markdown } from "@revolt/markdown";
import { Avatar, Embed, MessageContainer, Username } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";

import { useInteractionErrorText } from "./errorText";
import { InteractionHeader } from "./InteractionHeader";
import { MessageComponents } from "./MessageComponents";
import {
  type PendingInteraction,
  dismissEphemeral,
  interactionState,
} from "./store";
import type { EphemeralMessage } from "./types";

type Entry =
  | { kind: "pending"; at: number; pending: PendingInteraction }
  | { kind: "ephemeral"; at: number; message: EphemeralMessage };

/**
 * Private answers of bots and the progress of this user's interactions in a
 * channel, shown at the end of the timeline like messages. They live only in
 * this client: the server never stores them as channel messages and never
 * sends them to anyone else.
 */
export function EphemeralMessages(props: {
  channelId: string;
  serverId?: string;
}) {
  const { t } = useLingui();
  const client = useClient();

  const entries = createMemo<Entry[]>(() => {
    const pending: Entry[] = Object.values(interactionState.pending)
      .filter(
        (entry) =>
          entry.channelId === props.channelId &&
          // commands show their progress; buttons and menus only "thinking"
          // (their own wait and their failures show at the component)
          (entry.label ||
            (entry.state === "failed" && !entry.componentKey) ||
            entry.state === "deferred"),
      )
      .map((pending) => ({ kind: "pending", at: pending.createdAt, pending }));
    const ephemeral: Entry[] = (
      interactionState.ephemeral[props.channelId] ?? []
    ).map((message) => ({
      kind: "ephemeral",
      at: decodeTime(message._id),
      message,
    }));
    return [...pending, ...ephemeral].sort((a, b) => a.at - b.at);
  });

  const errorText = useInteractionErrorText();

  const thinking = (id: string) => {
    const name = botName(client, id, t`The bot`);
    return t`${name} is thinking…`;
  };

  /** Header for the user's own command, from what they ran */
  const header = (label?: string, botId?: string) => (
    <Show when={label}>
      <InteractionHeader
        userId={client().user!.id}
        name={label!.startsWith("/") ? label!.slice(1) : label!}
        serverId={props.serverId}
        botId={botId}
      />
    </Show>
  );

  return (
    <Show when={entries().length}>
      <div aria-live="polite">
        <For each={entries()}>
          {(entry) => (
            <Switch>
              <Match when={entry.kind === "pending" && entry}>
                {(item) => (
                  <BotMessage
                    botId={item().pending.applicationId}
                    at={item().at}
                    header={header(
                      item().pending.label,
                      item().pending.applicationId,
                    )}
                  >
                    <Switch>
                      <Match when={item().pending.state === "failed"}>
                        <ErrorText>
                          <Symbol size={16}>error</Symbol>
                          {errorText(item().pending.error)}
                        </ErrorText>
                      </Match>
                      <Match when={item().pending.state === "deferred"}>
                        <Thinking>
                          <Dots aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </Dots>
                          {thinking(item().pending.applicationId)}
                        </Thinking>
                      </Match>
                      <Match when={true}>
                        <Thinking>{t`Sending command…`}</Thinking>
                      </Match>
                    </Switch>
                  </BotMessage>
                )}
              </Match>
              <Match when={entry.kind === "ephemeral" && entry}>
                {(item) => (
                  <BotMessage
                    botId={item().message.author}
                    at={item().at}
                    edited={item().message.edited}
                    header={header(
                      interactionState.labels[item().message.interaction_id],
                      item().message.author,
                    )}
                  >
                    <Show when={item().message.content}>
                      <Body>
                        <Markdown content={item().message.content!} />
                      </Body>
                    </Show>
                    <For each={item().message.embeds ?? []}>
                      {(embed) => (
                        <Embed
                          embed={MessageEmbed.from(client(), {
                            type: "Text",
                            ...(embed as Record<string, unknown>),
                          } as API.Embed)}
                        />
                      )}
                    </For>
                    <MessageComponents
                      blocks={item().message.components}
                      channelId={props.channelId}
                      messageId={item().message._id}
                      serverId={props.serverId}
                    />
                    <Private>
                      <Symbol size={14}>visibility</Symbol>
                      <span>{t`Only you can see this`}</span>
                      <span aria-hidden="true">·</span>
                      <Dismiss
                        type="button"
                        onClick={() =>
                          dismissEphemeral(props.channelId, item().message._id)
                        }
                      >
                        {t`Dismiss message`}
                      </Dismiss>
                    </Private>
                  </BotMessage>
                )}
              </Match>
            </Switch>
          )}
        </For>
      </div>
    </Show>
  );
}

function botName(
  client: ReturnType<typeof useClient>,
  id: string,
  fallback: string,
) {
  const user = client().users.get(id);
  return user?.displayName ?? user?.username ?? fallback;
}

/**
 * A bot's message that only this client shows
 */
function BotMessage(props: {
  botId: string;
  at: number;
  /** When the bot last changed it */
  edited?: string;
  header?: JSX.Element;
  children: JSX.Element;
}) {
  const { t } = useLingui();
  const client = useClient();
  const bot = () => client().users.get(props.botId);

  return (
    <MessageContainer
      timestamp={new Date(props.at)}
      edited={props.edited ? new Date(props.edited) : undefined}
      header={props.header}
      avatar={<Avatar size={36} src={bot()?.avatarURL} />}
      username={
        <Username username={botName(client, props.botId, t`The bot`)} />
      }
      info={<BotLabel verified={bot()?.verifiedBot} />}
    >
      {props.children}
    </MessageContainer>
  );
}

const Body = styled("div", {
  base: { overflowWrap: "anywhere" },
});

const Thinking = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--z-fg-muted)",
    fontStyle: "italic",
  },
});

const Dots = styled("span", {
  base: {
    display: "inline-flex",
    gap: "3px",
    "& i": {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "var(--z-fg-muted)",
      animation: "zThinking 1.2s infinite ease-in-out",
    },
    "& i:nth-child(2)": { animationDelay: "0.15s" },
    "& i:nth-child(3)": { animationDelay: "0.3s" },
    "@media (prefers-reduced-motion: reduce)": {
      "& i": { animation: "none" },
    },
  },
});

const ErrorText = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "var(--z-danger)",
  },
});

const Private = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Dismiss = styled("button", {
  base: {
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--z-link)",
    cursor: "pointer",
    fontSize: "12px",
    "&:hover": { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});
