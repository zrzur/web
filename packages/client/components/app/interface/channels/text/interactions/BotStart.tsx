import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { ContextMenuButton } from "@revolt/app/menus/ContextMenu";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Avatar, Button } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useBotDms } from "./botDms";
import { dmBot, markStarted, waitingPayload } from "./botLinks";
import { interactionState, runStart } from "./store";

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
    // Start and Restart: 44 px targets on phones
    _phone: { "& button": { minHeight: "44px" } },
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
