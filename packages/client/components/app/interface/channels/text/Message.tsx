import {
  Accessor,
  createContext,
  createMemo,
  createSignal,
  For,
  JSX,
  Match,
  onMount,
  Show,
  Switch,
  useContext,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { threadIsReadOnly } from "@revolt/app/interface/channels/threadAccess";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { OfficialLabel } from "@revolt/ui/components/features/profiles/OfficialLabel";

import { Message as MessageInterface } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { useClient } from "@revolt/client";
import { isOnlyGifLink, isOnlyMediaLink } from "@revolt/common/lib/gifs";
import { useTime } from "@revolt/i18n";
import { Markdown } from "@revolt/markdown";
import { startsWithPackPUA } from "@revolt/markdown/emoji/UnicodeEmoji";
import { useState } from "@revolt/state";
import {
  Attachment,
  Avatar,
  CompositionMediaPicker,
  Embed,
  MessageContainer,
  MessageReply,
  Reactions,
  SystemMessage,
  SystemMessageIcon,
  Tooltip,
  Username,
} from "@revolt/ui";
import { MediaPickerProps } from "@revolt/ui/components/features/messaging/composition/picker/CompositionMediaPicker";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { MessageContextMenu } from "../../../menus/MessageContextMenu";
import {
  floatingUserMenus,
  floatingUserMenusFromMessage,
} from "../../../menus/UserContextMenu";

import { createIsTimedOut } from "@revolt/common/lib/createIsTimedOut";
import { EditMessage } from "./EditMessage";
import { ForwardedFrame } from "./ForwardedFrame";
import { InteractionHeader } from "./interactions/InteractionHeader";
import {
  MessageComponents,
  placedAttachments,
} from "./interactions/MessageComponents";
import { PollCard } from "./poll/PollCard";
import { ThreadChip } from "./ThreadChip";

interface Props {
  /**
   * Message
   */
  message: MessageInterface;

  /**
   * Whether this is the tail of another message
   */
  tail?: boolean;

  /**
   * Whether to highlight this message
   */
  highlight?: boolean;

  /**
   * Whether to replace content with editor
   */
  editing?: boolean;

  /**
   * Whether this message is a link
   */
  isLink?: boolean | "hide";
}

interface MessageContextShape {
  message: MessageInterface;
  reactPicker: Accessor<MediaPickerProps | undefined>;
}

const messageContext = createContext<Partial<MessageContextShape>>({});

/** Messages bridged from another platform post under the sender's name */
const BRIDGE_USER = "01FHGJ3NPP7XANQQH8C2BE44ZY";

function MessageContext(
  props: { children: JSX.Element } & MessageContextShape,
) {
  /* eslint-disable solid/reactivity */
  const contextShape = {
    message: props.message,
    reactPicker: props.reactPicker,
  };

  return (
    <messageContext.Provider value={contextShape}>
      {props.children}
    </messageContext.Provider>
  );
}

export const useMessage = () => useContext(messageContext);

/**
 * Render a Message with or without a tail
 */
export function Message(props: Props) {
  const dayjs = useTime();
  const state = useState();
  const { t } = useLingui();
  const client = useClient();

  const [isHovering, setIsHovering] = createSignal(false);
  const [reactPicker, setReactPicker] = createSignal<MediaPickerProps>();
  let msgRef!: HTMLDivElement;

  /**
   * Determine whether this message is only a GIF or a direct media link,
   * in which case the link text is hidden and just the media shows
   */
  const isOnlyGIF = () =>
    isOnlyGifLink(props.message.content, props.message.embeds) ||
    isOnlyMediaLink(props.message.content, props.message.embeds);

  /**
   * React with an emoji
   * @param emoji Emoji
   */
  const react = (emoji: string) => props.message.react(emoji);

  /**
   * Remove emoji reaction
   * @param emoji Emoji
   */
  const unreact = (emoji: string) => props.message.unreact(emoji);

  // Derive pronouns member takes precedence over author
  const pronouns = () =>
    props.message.member?.pronouns ?? props.message.author?.pronouns;

  const timedOut = createIsTimedOut(() => props.message.member?.timeout);

  const moderationPerms = createMemo(() =>
    props.message.member?.server?.member?.hasPermission(
      props.message.member!.server! ?? props.message.channel!,
      "TimeoutMembers",
    ),
  );

  // the real name of a bot that posts under another name
  const botName = () =>
    props.message.author?.displayName ?? props.message.author?.username;

  // a person under another name: their real name is always shown next to it
  const realName = () =>
    props.message.member?.nickname ??
    props.message.author?.displayName ??
    props.message.author?.username;
  const personMasquerade = () =>
    !!props.message.masquerade &&
    !props.message.webhook &&
    !props.message.author?.bot &&
    props.message.authorId !== BRIDGE_USER &&
    !!realName();

  return (
    <MessageContext message={props.message} reactPicker={reactPicker}>
      <MessageContainer
        ref={msgRef}
        onHover={setIsHovering}
        username={
          <div use:floating={floatingUserMenusFromMessage(props.message)}>
            <Username
              username={
                props.message.masquerade?.name ??
                props.message.member?.nickname ??
                props.message.author?.displayName ??
                props.message.author?.username ??
                props.message.username
              }
              colour={props.message.roleColour!}
              userStyle={
                props.message.masquerade
                  ? undefined
                  : props.message.author?.style
              }
            />
          </div>
        }
        avatar={
          <div
            class={avatarContainer()}
            use:floating={floatingUserMenusFromMessage(props.message)}
          >
            <AvatarDecoration
              decoration={
                props.message.masquerade
                  ? undefined
                  : props.message.author?.style?.decoration
              }
              file={props.message.author?.style?.decoration_file}
              size={36}
            >
              <Avatar
                size={36}
                src={
                  isHovering()
                    ? props.message.animatedAvatarURL
                    : props.message.avatarURL
                }
              />
            </AvatarDecoration>
          </div>
        }
        pronouns={pronouns()}
        contextMenu={
          props.editing
            ? undefined
            : () => (
                <MessageContextMenu
                  message={props.message}
                  reactPicker={reactPicker}
                />
              )
        }
        timestamp={props.message.createdAt}
        edited={props.message.editedAt}
        mentioned={props.message.mentioned}
        highlight={props.highlight}
        editing={props.editing}
        isLink={props.isLink}
        tail={props.tail || state.settings.getValue("appearance:compact_mode")}
        header={
          <>
            <Show when={props.message.interaction?.name}>
              <InteractionHeader
                userId={props.message.interaction!.user}
                name={props.message.interaction!.name!}
                serverId={props.message.server?.id}
                botId={props.message.authorId}
              />
            </Show>
            <For each={props.message.replyIds}>
              {(reply_id) => {
                /**
                 * Signal the actual message
                 */
                const message = () => client().messages.get(reply_id);

                onMount(() => {
                  if (!message()) {
                    props.message.channel!.fetchMessage(reply_id);
                  }
                });

                return (
                  <MessageReply
                    mention={props.message.mentionIds?.includes(
                      message()!.authorId!,
                    )}
                    message={message()}
                  />
                );
              }}
            </For>
          </>
        }
        info={
          <Switch fallback={<div />}>
            {/* a bot under another name always says it is a bot, and which one */}
            <Match when={props.message.masquerade && props.message.author?.bot}>
              <Tooltip
                content={t`Sent by the bot ${botName()}`}
                placement="top"
              >
                <span tabindex="0" aria-label={t`Sent by the bot ${botName()}`}>
                  <BotLabel official={props.message.author?.officialBot} />
                </span>
              </Tooltip>
            </Match>
            <Match when={personMasquerade()}>
              <Tooltip content={t`Sent by ${realName()}`} placement="top">
                <SentBy tabindex="0" aria-label={t`Sent by ${realName()}`}>
                  {t`via ${realName()}`}
                </SentBy>
              </Tooltip>
            </Match>
            <Match when={props.message.iconRole}>
              <Tooltip content={props.message.iconRole!.name} placement="top">
                <Avatar
                  size={16}
                  shape="rounded-square"
                  src={props.message.iconRole!.icon?.previewUrl}
                />
              </Tooltip>
            </Match>
            <Match
              when={
                props.message.masquerade &&
                props.message.authorId === BRIDGE_USER
              }
            >
              <Tooltip
                content={t`Message was sent on another platform`}
                placement="top"
              >
                <Symbol size={16}>link</Symbol>
              </Tooltip>
            </Match>
            <Match when={props.message.author?.official}>
              <OfficialLabel />
            </Match>
            <Match when={props.message.author?.privileged}>
              <Tooltip content={t`Official Communication`} placement="top">
                <Symbol size={16}>brightness_alert</Symbol>
              </Tooltip>
            </Match>
            <Match when={props.message.author?.bot}>
              {/* the same word tag as profiles and the member list */}
              <BotLabel official={props.message.author?.officialBot} />
            </Match>
            <Match when={props.message.webhook}>
              <Tooltip content={t`Webhook`} placement="top">
                <Symbol size={16} fill>
                  webhooks-logo
                </Symbol>
              </Tooltip>
            </Match>
            <Match when={props.message.isSuppressed}>
              <Tooltip content={t`Silent`} placement="top">
                <Symbol size={16} fill>
                  notifications_off
                </Symbol>
              </Tooltip>
            </Match>
            <Match when={timedOut() && moderationPerms()}>
              <Tooltip
                content={t`Timed Out until ${props.message.member!.timeout!.toLocaleString()}`}
                placement="top"
              >
                <Symbol size={16} color="var(--md-sys-color-error)">
                  timer_off
                </Symbol>
              </Tooltip>
            </Match>
            <Match
              when={
                props.message.authorId &&
                dayjs().diff(decodeTime(props.message.authorId), "day") < 1
              }
            >
              <NewUser>
                <Tooltip content={t`New to Zrzur`} placement="top">
                  <Symbol size={16} fill>
                    spa
                  </Symbol>
                </Tooltip>
              </NewUser>
            </Match>
            <Match
              when={
                props.message.member &&
                dayjs().diff(props.message.member.joinedAt, "day") < 1
              }
            >
              <NewUser>
                <Tooltip content={t`New to the server`} placement="top">
                  <Symbol size={16}>spa</Symbol>
                </Tooltip>
              </NewUser>
            </Match>
            {/* <Match when={props.message.authorId === "01EX2NCWQ0CHS3QJF0FEQS1GR4"}>
            <span />
            <span>placeholder &middot; </span>
          </Match> */}
          </Switch>
        }
        compact={
          !!props.message.systemMessage ||
          state.settings.getValue("appearance:compact_mode")
        }
        infoMatch={
          <Match when={props.message.systemMessage}>
            <SystemMessageIcon
              systemMessage={props.message.systemMessage!}
              createdAt={props.message.createdAt}
              isServer={!!props.message.server}
            />
          </Match>
        }
      >
        <Show when={props.message.systemMessage}>
          <SystemMessage
            systemMessage={props.message.systemMessage!}
            menuGenerator={(user) =>
              user
                ? floatingUserMenus(
                    user!,
                    // TODO: try to fetch on demand member
                    props.message.server?.getMember(user!.id),
                  )
                : {}
            }
            isServer={!!props.message.server}
          />
        </Show>
        <CompositionMediaPicker
          channel={props.message.channel}
          onMessage={(content) =>
            props.message?.channel?.sendMessage({
              content,
              replies: [{ id: props.message.id, mention: true }],
            })
          }
          onTextReplacement={(emoji) =>
            react(
              emoji.startsWith(":")
                ? emoji.slice(1, emoji.length - 1)
                : startsWithPackPUA(emoji)
                  ? emoji.slice(1)
                  : emoji,
            )
          }
        >
          {(trigProps) => {
            trigProps.ref(msgRef);
            setReactPicker(trigProps);
            return <></>;
          }}
        </CompositionMediaPicker>
        <ForwardedFrame origin={props.message.forwarded}>
          <Switch>
            <Match when={props.editing}>
              <EditMessage message={props.message} />
            </Match>
            <Match when={props.message.content && !isOnlyGIF()}>
              <BreakText>
                <Markdown content={props.message.content!} />
              </BreakText>
            </Match>
          </Switch>
          <For
            each={props.message.attachments?.filter(
              (file) =>
                !placedAttachments(props.message.components).has(file.id),
            )}
          >
            {(attachment) => (
              <Attachment message={props.message} file={attachment} />
            )}
          </For>
          <For each={props.message.embeds}>
            {(embed) => <Embed embed={embed} />}
          </For>
        </ForwardedFrame>
        <Show when={props.message.poll}>
          <PollCard message={props.message} />
        </Show>
        <MessageComponents
          blocks={props.message.components}
          channelId={props.message.channelId}
          messageId={props.message.id}
          serverId={props.message.server?.id}
          attachments={props.message.attachments}
          message={props.message}
        />
        <Reactions
          reactions={props.message.reactions}
          interactions={props.message.interactions}
          userId={client().user!.id}
          readOnly={
            !!props.message.channel && threadIsReadOnly(props.message.channel)
          }
          addReaction={react}
          removeReaction={unreact}
        />
        <ThreadChip message={props.message} />
      </MessageContainer>
    </MessageContext>
  );
}

/**
 * New user indicator
 */
const NewUser = styled("div", {
  base: {
    fill: "var(--md-sys-color-primary)",
  },
});

/**
 * Avatar container
 */
const avatarContainer = cva({
  base: {
    height: "fit-content",
    borderRadius: "var(--borderRadius-circle)",
  },
});

/**
 * Break all text and prevent overflow from math blocks
 */
const BreakText = styled("div", {
  base: {
    wordBreak: "break-word",

    "& .math": {
      overflowX: "auto",
      overflowY: "hidden",
      maxHeight: "100vh",
    },
  },
});

/** "via name": who really sent a message under another name */
const SentBy = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--z-fg-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "160px",
    borderRadius: "4px",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
