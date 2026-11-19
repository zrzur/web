import { Show, createEffect, on } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  knownLink,
  linkNoticeKind,
  linkedChannelsOpen,
  loadLink,
} from "./linkedChannels";

/**
 * Above the message box of a linked channel, always in view: what is
 * written here also goes to another platform. Said before every post, to
 * everyone who can read the channel.
 */
export function LinkedChannelNotice(props: { channel: Channel }) {
  const client = useClient();
  const instance = useInstance();

  const open = () =>
    linkedChannelsOpen(instance.config.features) &&
    props.channel.type === "TextChannel" &&
    !!props.channel.serverId;

  const link = () => {
    if (!open()) return undefined;
    loadLink(client(), props.channel.id);
    return knownLink(props.channel.id);
  };

  // a link that begins or ends is announced in the channel: ask again then
  createEffect(
    on(
      () => props.channel.lastMessageId,
      (id) => {
        if (!open() || !id) return;
        const system = client().messages.get(id)?.systemMessage as
          | { type: string; content?: string }
          | undefined;
        if (system?.type === "text" && linkNoticeKind(system.content ?? ""))
          loadLink(client(), props.channel.id, true);
      },
      { defer: true },
    ),
  );

  return (
    <Show when={link()}>
      <Notice role="note" data-linked-notice>
        <Icon name="link" size={16} />
        <span>
          <Trans>
            Messages here are also posted to a Discord server by this server's
            bridge bot. Discord's privacy policy applies there.
          </Trans>
        </span>
      </Notice>
    </Show>
  );
}

const Notice = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    margin: "0 16px 8px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    lineHeight: "20px",
    "& > svg, & > span:first-child": { flexShrink: 0, marginTop: "2px" },
  },
});
