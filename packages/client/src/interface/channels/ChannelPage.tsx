import { Component, Match, Switch, createMemo, createResource } from "solid-js";

import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Navigate, useParams } from "@revolt/routing";

import { AgeGate } from "./AgeGate";
import { ForumChannel } from "./forum/ForumChannel";
import { TextChannel } from "./text/TextChannel";
import { VoiceChannel } from "./voice/VoiceChannel";

/**
 * Channel layout
 */
const Base = styled("div", {
  base: {
    minWidth: 0,
    flexGrow: 1,
    display: "flex",
    position: "relative",
    flexDirection: "column",
  },
});

export interface ChannelPageProps {
  channel: Channel;
}

const TEXT_CHANNEL_TYPES: Channel["type"][] = [
  "TextChannel",
  "DirectMessage",
  "Group",
  "SavedMessages",
];

/**
 * Channel component
 */
export const ChannelPage: Component = () => {
  const params = useParams();
  const client = useClient();
  const cached = createMemo(() => client()!.channels.get(params.channel));
  // a channel the session doesn't know yet (an archived thread opened from
  // a link) is fetched once before giving up
  const [fetched] = createResource(
    () => (cached() ? undefined : params.channel),
    (id) =>
      client()!
        .channels.fetch(id)
        .catch(() => undefined),
  );
  const channel = createMemo(() => (cached() ?? fetched())!);

  return (
    <Base>
      <Switch fallback="Unknown channel type!">
        <Match when={!channel() && fetched.loading}>{null}</Match>
        <Match when={!channel()}>
          <Navigate href={"../.."} />
        </Match>
        <Match when={channel()!.type === "TextChannel" && channel()!.isForum}>
          <AgeGate
            enabled={channel().mature || !!channel().server?.mature}
            contentId={channel().id}
            contentName={channel().name}
            contentType="channel"
          >
            <ForumChannel channel={channel()} />
          </AgeGate>
        </Match>
        <Match when={channel()!.type === "TextChannel" && channel()!.isVoice}>
          <AgeGate
            enabled={channel().mature || !!channel().server?.mature}
            contentId={channel().id}
            contentName={channel().name}
            contentType="channel"
          >
            <VoiceChannel channel={channel()} />
          </AgeGate>
        </Match>
        <Match when={TEXT_CHANNEL_TYPES.includes(channel()!.type)}>
          <AgeGate
            enabled={channel().mature || !!channel().server?.mature}
            contentId={channel().id}
            contentName={"#" + channel().name}
            contentType="channel"
          >
            <TextChannel channel={channel()} />
          </AgeGate>
        </Match>
        {/* <Match when={channel()!.type === "VoiceChannel"}>
            <Header placement="primary">
              <ChannelHeader channel={channel()} />
            </Header>
          </Match> */}
      </Switch>
    </Base>
  );
};
