import { Show, createSignal } from "solid-js";

import type { WebsiteEmbed } from "@zrzur/sdk/solid";

import { SizedContent } from "@revolt/ui/components/utils";

import { SpecialEmbedPlaceholder } from "./SpecialEmbedPlaceholder";
import {
  PLAYER_PROVIDERS,
  allowMediaPlayer,
  alwaysLoadMediaPlayers,
  isMediaPlayerAllowed,
} from "./embedSettings";

/**
 * Special Embed: a player from another site (YouTube, Twitch, Spotify, ...).
 *
 * The iframe is created only after a click on "Load", or at once when the
 * person turned on "Always load media players from other sites". Before that
 * no request goes to the provider.
 */
export function SpecialEmbed(props: { embed: WebsiteEmbed }) {
  const [clicked, setClicked] = createSignal(false);

  /**
   * Determine the media size
   */
  function getSize() {
    const special = props.embed.specialContent!;

    let width = 0,
      height = 0;
    switch (special.type) {
      case "YouTube": {
        width = props.embed.video?.width ?? 1280;
        height = props.embed.video?.height ?? 720;
        break;
      }
      case "Twitch": {
        width = 1280;
        height = 720;
        break;
      }
      case "Spotify": {
        width = 420;
        height = 355;
        break;
      }
      case "Soundcloud": {
        width = 480;
        height = 460;
        break;
      }
      case "Bandcamp": {
        width = props.embed.video?.width ?? 1280;
        height = props.embed.video?.height ?? 720;
        break;
      }
      case "Streamable": {
        width = props.embed.video?.width ?? 1280;
        height = props.embed.video?.height ?? 720;
        break;
      }
      case "AppleMusic": {
        width = 450;
        height = special.track_id ? 175 : 450;
        break;
      }
    }

    return { width, height };
  }

  /** the SDK has no address for Apple Music, so build it here */
  function playerUrl() {
    const special = props.embed.specialContent;
    if (special?.type === "AppleMusic") {
      const url = new URL(
        `https://embed.music.apple.com/us/album/${encodeURIComponent(special.album_id)}`,
      );
      if (special.track_id) url.searchParams.set("i", special.track_id);
      return url.toString();
    }
    return props.embed.embedURL;
  }

  const provider = () =>
    PLAYER_PROVIDERS[props.embed.specialContent?.type ?? ""] ?? {
      name: props.embed.siteName ?? "",
      company: props.embed.siteName ?? "",
    };

  return (
    <SizedContent width={getSize()?.width} height={getSize()?.height}>
      <Show
        when={
          clicked() ||
          alwaysLoadMediaPlayers() ||
          isMediaPlayerAllowed(props.embed.specialContent?.type)
        }
        fallback={
          <SpecialEmbedPlaceholder
            provider={provider().name}
            company={provider().company}
            title={props.embed.title ?? undefined}
            // the embed around the card shows the site name and the title
            heading={!props.embed.siteName}
            // proxied by our own link proxy, never the provider's address
            thumbnail={props.embed.image?.proxiedURL}
            onLoad={() => {
              setClicked(true);
              allowMediaPlayer(props.embed.specialContent?.type);
            }}
          />
        }
      >
        <iframe
          loading="lazy"
          scrolling="no"
          allowfullscreen
          allowtransparency
          frameborder={0}
          // style={{ width: getSize()?.width + "px" }}
          src={playerUrl()}
        />
      </Show>
    </SizedContent>
  );
}
