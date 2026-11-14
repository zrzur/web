import { Match, Show, Switch } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import {
  ImageEmbed,
  MessageEmbed,
  TextEmbed as TextEmbedClass,
  VideoEmbed,
  WebsiteEmbed,
} from "@zrzur/sdk/solid";
import { css } from "styled-system/css";

import { isGif as isGifLib } from "@revolt/common/lib/gifs";
import { useModals } from "@revolt/modal";
import { SizedContent } from "@revolt/ui/components/utils";

import { MessageContextMenu } from "@revolt/app";
import { MediaPlayer } from "./MediaPlayer";
import { SpecialEmbed } from "./SpecialEmbed";
import { TextEmbed } from "./TextEmbed";
import { isPlayerEmbed } from "./embedSettings";

/**
 * Render a given embed
 */
export function Embed(props: { embed: MessageEmbed }) {
  const { t } = useLingui();
  const { openModal } = useModals();

  /**
   * Whether the embed is a GIF
   */
  const isGIF = () => isGifLib(props.embed);

  /**
   * Whether there is a video
   */
  const video = () =>
    (props.embed.type === "Video"
      ? (props.embed as VideoEmbed)
      : isGIF() && (props.embed as WebsiteEmbed).video) || undefined;

  /**
   * Whether there is a image
   */
  const image = () =>
    (props.embed.type === "Image"
      ? (props.embed as ImageEmbed)
      : isGIF() && (props.embed as WebsiteEmbed).image) || undefined;

  return (
    <Switch fallback={`Could not render ${props.embed.type}!`}>
      <Match when={image() && !(isGIF() && video())}>
        <SizedContent width={image()!.width} height={image()!.height}>
          <img
            // always our link proxy, also for Klipy, Tenor and Giphy
            src={image()!.proxiedURL}
            alt={t`Image`}
            use:floating={{
              contextMenu: () => <MessageContextMenu file={image()} />,
            }}
            loading="lazy"
            class={css({ cursor: "pointer" })}
            onClick={() =>
              openModal({
                type: "image_viewer",
                embed: image(),
              })
            }
          />
        </SizedContent>
      </Match>
      <Match when={video()}>
        <SizedContent width={video()!.width} height={video()!.height}>
          <Show
            when={isGIF()}
            fallback={
              <MediaPlayer
                kind="video"
                src={video()!.proxiedURL}
                contextMenu={() => <MessageContextMenu file={video()} />}
              />
            }
          >
            <video
              playsinline
              loop={isGIF()}
              muted={isGIF()}
              autoplay={isGIF()}
              controls={!isGIF()}
              preload="metadata"
              // always our link proxy, also for Klipy, Tenor and Giphy
              src={video()!.proxiedURL}
              use:floating={{
                contextMenu: () => <MessageContextMenu file={video()} />,
              }}
              class={css({ cursor: isGIF() ? "pointer" : "unset" })}
              onClick={() =>
                isGIF() &&
                openModal({
                  type: "image_viewer",
                  gif: video(),
                })
              }
            />
          </Show>
        </SizedContent>
      </Match>
      {/* a site with its own player (Spotify, Apple Music, YouTube, ...)
          shows that player alone, not our card around it */}
      <Match
        when={
          props.embed.type === "Website" &&
          isPlayerEmbed((props.embed as WebsiteEmbed).specialContent?.type) &&
          // a "Player" only when its address passed the SDK's host list
          !!(props.embed as WebsiteEmbed).embedURL
        }
      >
        <SpecialEmbed embed={props.embed as WebsiteEmbed} standalone />
      </Match>
      <Match
        when={props.embed.type === "Website" || props.embed.type === "Text"}
      >
        <TextEmbed embed={props.embed as WebsiteEmbed | TextEmbedClass} />
      </Match>
      <Match when={props.embed.type === "None"}> </Match>
    </Switch>
  );
}
