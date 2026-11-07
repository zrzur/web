import type { MessageEmbed, WebsiteEmbed } from "@zrzur/sdk/solid";

function embedUrl(embed: MessageEmbed): URL | undefined {
  const value =
    embed.type === "Website"
      ? (embed as WebsiteEmbed).originalUrl || (embed as WebsiteEmbed).url
      : (embed as { url?: string }).url;
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return;
    return url;
  } catch {
    return;
  }
}

/** Only recognized GIF pages/media are rendered as looping GIFs. No substring host matches. */
export function isGif(embed: MessageEmbed): boolean {
  const url = embedUrl(embed);
  if (!url) return false;
  const host = url.hostname.replace(/^www\./, "");
  if (embed.type === "Website") {
    return (
      (host === "giphy.com" &&
        /^\/(gifs|embed)\/[^/]+\/?$/.test(url.pathname)) ||
      (host === "tenor.com" && /^\/view\/[^/]+\/?$/.test(url.pathname)) ||
      (host === "gifbox.me" && /^\/view\/[^/]+\/?$/.test(url.pathname)) ||
      (host === "klipy.com" && /^\/gifs\/[^/]+\/?$/.test(url.pathname))
    );
  }
  return (
    (embed.type === "Image" || embed.type === "Video") &&
    (/^media\d*\.giphy\.com$/.test(host) ||
      host === "i.giphy.com" ||
      host === "media.tenor.com" ||
      host === "static.klipy.com") &&
    /\.(gif|mp4|webm|webp)$/i.test(url.pathname)
  );
}

/**
 * A message that is nothing but one direct image or video link shows just
 * the media (the media server already proxied and checked it), like a
 * normal upload. Links with any other text stay visible.
 */
export function isOnlyMediaLink(
  content: string | undefined,
  embeds: MessageEmbed[] | undefined,
): boolean {
  if (!content || embeds?.length !== 1) return false;
  const embed = embeds[0];
  if (embed.type !== "Image" && embed.type !== "Video") return false;
  const url = embedUrl(embed);
  if (!url) return false;
  try {
    return new URL(content.trim()).href === url.href;
  } catch {
    return false;
  }
}

/** Historical gifbox embeds keep their configured proxy behavior. */
export function isGifBox(embed: MessageEmbed): boolean {
  return embedUrl(embed)?.hostname.replace(/^www\./, "") === "gifbox.me";
}

/** Hide only a standalone GIF URL; preserve accompanying text and other links. */
export function isOnlyGifLink(
  content: string | undefined,
  embeds: MessageEmbed[] | undefined,
): boolean {
  if (!content || embeds?.length !== 1 || !isGif(embeds[0])) return false;
  if (
    embeds[0].type === "Website" &&
    !(embeds[0] as WebsiteEmbed).video &&
    !(embeds[0] as WebsiteEmbed).image
  )
    return false;
  const url = embedUrl(embeds[0]);
  try {
    return new URL(content.trim()).href === url?.href;
  } catch {
    return false;
  }
}
