import { For, Show, createMemo, createResource, onMount } from "solid-js";

import { i18n } from "@lingui/core";
import { Trans } from "@lingui/solid/macro";
import type { Channel, Client, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { Avatar, Button } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { botStartState, markStarted, waitingPayload } from "./botLinks";
import { interactionState, loadDmCommands, runStart } from "./store";
import { localized } from "./types";

/** Commands shown before "and N more" */
const SHOWN = 5;

/** Whether bots can be started in DMs on this server (`features.bot_dms`) */
export function useBotDms() {
  const client = useClient();
  return () => client()?.configuration?.features?.bot_dms === true;
}

/** The bot of a DM with a bot, else nothing */
export function dmBot(channel: Channel): User | undefined {
  return channel.type === "DirectMessage" && channel.recipient?.bot
    ? channel.recipient
    : undefined;
}

/**
 * Whether the empty conversation still waits for Start: nobody wrote in it
 * and Start was not pressed (a bot link opened again resets that). With
 * messages, a bot link gets the Start bar above the message box instead.
 *
 * The card is drawn only once the history is loaded to its start, so the
 * messages the app holds decide: the channel's last message id can still
 * name a message that was deleted.
 */
export function waitsForStart(client: Client, channel: Channel) {
  const bot = dmBot(channel);
  if (!bot || bot.relationship === "Blocked") return false;
  return !loadedMessage(client, channel) && !botStartState.started[channel.id];
}

/** A message of this conversation the app holds, if any */
function loadedMessage(client: Client, channel: Channel) {
  return client.messages.find((message) => message.channelId === channel.id);
}

/**
 * Whether anyone wrote in the conversation. The channel's last message id
 * is saved by the server a moment after a message, so a page loaded just
 * then has none: the messages the app holds count too.
 */
export function hasHistory(client: Client, channel: Channel) {
  return !!channel.lastMessageId || !!loadedMessage(client, channel);
}

/** Restart bot: unblock it, then press Start again */
function useRestartBot(channel: () => Channel) {
  const client = useClient();
  const { showError } = useModals();
  const botDms = useBotDms();
  return () => {
    const bot = dmBot(channel());
    if (!bot) return;
    const id = channel().id;
    bot
      .unblockUser()
      .then(() =>
        botDms()
          ? runStart(client(), id, bot.id, waitingPayload(id)).then(
              (accepted) => accepted && markStarted(id),
            )
          : undefined,
      )
      .catch((error) => {
        // an interaction's failure is shown in the timeline already
        if (!(error as { type?: string })?.type) showError(error);
      });
  };
}

/** Press Start: the bot gets the link's payload, if a link was opened */
export function useStartBot(channel: () => Channel, onStart?: () => void) {
  const client = useClient();
  const { showError } = useModals();
  return {
    busy: () => !!interactionState.busy[`start:${channel().id}`],
    start() {
      const bot = dmBot(channel());
      if (!bot) return;
      const id = channel().id;
      // the answer comes at the end of the conversation: go there
      onStart?.();
      runStart(client(), id, bot.id, waitingPayload(id))
        .then((accepted) => accepted && markStarted(id))
        // the reason is also shown in the timeline, where the answer goes
        .catch((error) => {
          if (!(error as { type?: string })?.type) showError(error);
        });
    },
  };
}

/**
 * The top of a conversation with a bot: who it is, what it says about
 * itself, what it can do, and Start while it waits for one
 */
export function BotStart(props: { channel: Channel }) {
  const client = useClient();
  const botDms = useBotDms();
  const bot = () => dmBot(props.channel)!;
  const starter = useStartBot(() => props.channel);

  const [profile] = createResource(
    () => bot().id,
    () =>
      bot()
        .fetchProfile()
        .catch(() => undefined),
  );
  onMount(() => {
    void loadDmCommands(client(), bot().id).catch(() => undefined);
  });

  const commands = createMemo(() =>
    (interactionState.commands[`dm:${bot().id}`]?.commands ?? [])
      .filter((command) => command.type === "ChatInput")
      .map((command) => ({
        id: command._id,
        name: localized(command.name, command.name_localizations, i18n.locale),
        description: localized(
          command.description ?? "",
          command.description_localizations,
          i18n.locale,
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const more = () => commands().length - SHOWN;
  const name = () => bot().displayName ?? bot().username;

  return (
    <Card data-bot-start>
      <Head>
        <Avatar src={bot().animatedAvatarURL} fallback={name()} size={64} />
        <Who>
          <NameRow>
            <Name dir="auto">{name()}</Name>
            <BotLabel
              official={bot().officialBot}
              verified={bot().verifiedBot}
            />
          </NameRow>
          <Handle dir="ltr">
            {bot().username}#{bot().discriminator}
          </Handle>
        </Who>
      </Head>

      <Show when={profile()?.content}>
        <Bio dir="auto" data-bot-start-bio>
          <Markdown content={profile()!.content} />
        </Bio>
      </Show>

      <Show when={commands().length}>
        <Section>
          <SectionTitle>
            <Trans>What this bot can do</Trans>
          </SectionTitle>
          <List data-bot-start-commands>
            <For each={commands().slice(0, SHOWN)}>
              {(command) => (
                <li>
                  <Command dir="ltr">/{command.name}</Command>
                  <Show when={command.description}>
                    <CommandText dir="auto">{command.description}</CommandText>
                  </Show>
                </li>
              )}
            </For>
          </List>
          <Show when={more() > 0}>
            <Hint>
              <Trans>and {more()} more in Commands</Trans>
            </Hint>
          </Show>
        </Section>
      </Show>

      <Show when={botDms() && waitsForStart(client(), props.channel)}>
        <StartRow>
          <Button
            variant="filled"
            data-bot-start-button
            isDisabled={starter.busy()}
            onPress={starter.start}
          >
            <Icon name="play" size={18} />
            <Trans>Start</Trans>
          </Button>
          <Hint>
            <Trans>Start lets {name()} send you messages here.</Trans>
          </Hint>
        </StartRow>
      </Show>
    </Card>
  );
}

/**
 * Above the message box when a bot link was opened for a conversation that
 * already has messages: the card with Start is far up in the history
 */
export function BotStartBar(props: {
  channel: Channel;
  /** Show the newest messages, where the bot's answer will be */
  onStart?: () => void;
}) {
  const starter = useStartBot(
    () => props.channel,
    () => props.onStart?.(),
  );
  const bot = () => dmBot(props.channel)!;
  const name = () => bot().displayName ?? bot().username;

  return (
    <Bar data-bot-start-bar>
      <Avatar src={bot().animatedAvatarURL} fallback={name()} size={32} />
      <BarText>
        <Trans>You opened a link to {name()}.</Trans>
      </BarText>
      <Button
        size="sm"
        variant="filled"
        data-bot-start-button
        isDisabled={starter.busy()}
        onPress={starter.start}
      >
        <Icon name="play" size={16} />
        <Trans>Start</Trans>
      </Button>
    </Bar>
  );
}

const Card = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "480px",
    boxSizing: "border-box",
    margin: "32px 16px 24px",
    padding: "16px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-primary)",
    _phone: { marginInline: "16px", marginBlockStart: "24px" },
  },
});

const Head = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 },
});

const Who = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 },
});

const NameRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },
});

const Name = styled("h2", {
  base: {
    margin: 0,
    fontSize: "22px",
    lineHeight: "30px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
});

const Handle = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    unicodeBidi: "isolate",
    alignSelf: "flex-start",
  },
});

const Bio = styled("div", {
  base: {
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
    lineClamp: 4,
  },
});

const Section = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const SectionTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const List = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      minWidth: 0,
    },
  },
});

const Command = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: "var(--fonts-monospace, monospace)",
    color: "var(--z-fg-primary)",
  },
});

const CommandText = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const StartRow = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    _phone: { alignItems: "stretch" },
  },
});

const Hint = styled("span", {
  base: { fontSize: "12px", lineHeight: "16px", color: "var(--z-fg-muted)" },
});

const Bar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginInline: "16px",
    marginBlockEnd: "8px",
    paddingBlock: "8px",
    paddingInline: "12px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
  },
});

const BarText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});

/**
 * In place of the message box after Stop bot (a block): the bot can't
 * write, and Restart undoes it and presses Start again
 */
export function BotStopped(props: { channel: Channel }) {
  const bot = () => dmBot(props.channel)!;
  const name = () => bot().displayName ?? bot().username;
  const restart = useRestartBot(() => props.channel);

  return (
    <Bar data-bot-stopped>
      <BarText>
        <Trans>You stopped {name()}. It can't send you messages.</Trans>
      </BarText>
      <Button size="sm" variant="tonal" onPress={restart}>
        <Trans>Restart bot</Trans>
      </Button>
    </Bar>
  );
}

/**
 * The DM header menu of a conversation with a bot: its profile, and Stop
 * bot (a block: it can't send anything) or Restart bot
 */
export function BotMenuItems(props: { channel: Channel }) {
  const { openModal, showError } = useModals();
  const bot = () => dmBot(props.channel)!;
  const restart = useRestartBot(() => props.channel);

  return (
    <>
      <ContextMenuButton
        icon={<Icon name="user-circle" size={20} />}
        onClick={() => openModal({ type: "user_profile", user: bot() })}
      >
        <Trans>View profile</Trans>
      </ContextMenuButton>
      <Show
        when={bot().relationship === "Blocked"}
        fallback={
          <ContextMenuButton
            icon={<Icon name="prohibit" size={20} />}
            data-testid="bot-stop"
            destructive
            onClick={() => void bot().blockUser().catch(showError)}
          >
            <Trans>Stop bot</Trans>
          </ContextMenuButton>
        }
      >
        <ContextMenuButton
          icon={<Icon name="play" size={20} />}
          data-testid="bot-restart"
          onClick={restart}
        >
          <Trans>Restart bot</Trans>
        </ContextMenuButton>
      </Show>
    </>
  );
}
