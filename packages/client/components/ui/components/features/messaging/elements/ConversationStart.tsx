import { Match, Show, Switch, createResource } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { isOfficialChannel } from "@revolt/app/interface/support/official";
import { Markdown } from "@revolt/markdown";
import { useNavigate } from "@revolt/routing";

import { OfficialLabel } from "../../profiles/OfficialLabel";

interface Props {
  /**
   * Channel information
   */
  channel: Channel;
}

/**
 * Mark the beginning of a conversation
 */
export function ConversationStart(props: Props) {
  const official = () => isOfficialChannel(props.channel);

  return (
    <Base>
      <Show when={props.channel.type !== "SavedMessages"}>
        <ChannelName>
          {props.channel.name ??
            props.channel.recipient?.displayName ??
            props.channel.recipient?.username}
          <Show when={official()}>
            <OfficialLabel />
          </Show>
        </ChannelName>
      </Show>
      <Description>
        <Switch
          fallback={<Trans>This is the start of your conversation.</Trans>}
        >
          <Match when={props.channel.type === "SavedMessages"}>
            <Trans>This is the start of your notes.</Trans>
          </Match>
          <Match when={official()}>
            <Trans>
              Official messages from the Zrzur team: answers from support and
              decisions about your account.
            </Trans>
          </Match>
        </Switch>
      </Description>
      <Show when={props.channel.thread?.starterMessageId}>
        {(id) => <StarterMessage channel={props.channel} messageId={id()} />}
      </Show>
    </Base>
  );
}

/**
 * The message a thread was started from, at the top of the thread, with a
 * link back to it in the channel
 */
function StarterMessage(props: { channel: Channel; messageId: string }) {
  const navigate = useNavigate();
  const [message] = createResource(
    () => props.channel.parent,
    (parent) => parent.fetchMessage(props.messageId).catch(() => undefined),
  );

  return (
    <Show when={message()}>
      {(starter) => (
        <Starter>
          <StarterAuthor>
            {starter().username ?? starter().author?.displayName}
          </StarterAuthor>
          <StarterBody>
            <Markdown content={starter().content} />
          </StarterBody>
          <StarterLink
            type="button"
            onClick={() =>
              navigate(
                `/server/${props.channel.serverId}/channel/${props.channel.parentId}/${props.messageId}`,
              )
            }
          >
            <Trans>Go to the message</Trans>
          </StarterLink>
        </Starter>
      )}
    </Show>
  );
}

/**
 * Base styles
 */
const Base = styled("div", {
  base: {
    display: "flex",
    userSelect: "none",
    flexDirection: "column",
    margin: "32px 16px 24px",
    gap: "4px",

    color: "var(--md-sys-color-on-surface)",
  },
});

const ChannelName = styled("h2", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: 0,
    fontSize: "22px",
    lineHeight: "30px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
});
const Description = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-secondary)",
  },
});

const Starter = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "8px",
    paddingBlock: "12px",
    paddingInline: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-raised)",
    userSelect: "text",
  },
});

const StarterAuthor = styled("span", {
  base: { fontSize: "13px", fontWeight: 600, color: "var(--z-fg-primary)" },
});

const StarterBody = styled("div", {
  base: {
    fontSize: "15px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const StarterLink = styled("button", {
  base: {
    alignSelf: "flex-start",
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--z-link)",
    fontSize: "13px",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
    _phone: { minHeight: "44px" },
  },
});
