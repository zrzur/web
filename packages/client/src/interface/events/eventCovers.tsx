import { Show } from "solid-js";

import { type API, File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";

/**
 * Cover art drawn for Zrzur events: a flat ground, one quiet geometric
 * pattern and one clear figure. The editor offers them as ready covers. An
 * event without a cover shows one of the grounds (always the same one for
 * the same event) with a calendar leaf, since nobody said what it is about. Artwork, so its colours are its own: they are not
 * interface colours and do not follow the theme.
 */
export const COVER_KINDS = ["cup", "pad", "pen", "book", "shield"] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

const WIDTH = 640;
const HEIGHT = 360;

const repeat = (count: number, draw: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => draw(index)).join("");

/** Ground, pattern line and figure colour of each cover */
const ART: Record<
  CoverKind,
  { ground: string; line: string; figure: string; pattern: string; d: string }
> = {
  cup: {
    ground: "#1E2C58",
    line: "#2F4284",
    figure: "#8DB4FF",
    pattern: repeat(
      13,
      (k) =>
        `<path d="M${k * 80 - 240} ${HEIGHT} ${k * 80 - 60} 0M${k * 80 - 60} ${HEIGHT} ${k * 80 - 240} 0"/>`,
    ),
    d: "M-40-52h80v32a40 40 0 0 1-80 0zM-40-42h-18a20 20 0 0 0 20 32M40-42h18a20 20 0 0 1-20 32M0 20v26M-26 56h52",
  },
  pad: {
    ground: "#1B3F3B",
    line: "#2A5F58",
    figure: "#79E0BD",
    pattern: repeat(
      9,
      (k) =>
        `<path d="M${k * 80 - 40} ${HEIGHT}v-170a40 40 0 0 1 80 0v170M${k * 80 - 20} ${HEIGHT}v-165a20 20 0 0 1 40 0v165"/>`,
    ),
    d: "M-58-28H58a26 26 0 0 1 26 26v12a24 24 0 0 1-43 14L32 14h-64l-9 10a24 24 0 0 1-43-14V-2a26 26 0 0 1 26-26ZM-42-14v22M-53-3h22M32-12h4M48 2h4",
  },
  pen: {
    ground: "#452039",
    line: "#6A3257",
    figure: "#FFADD4",
    pattern: repeat(
      11,
      (k) => `<circle cx="${WIDTH}" cy="${HEIGHT}" r="${60 + k * 60}"/>`,
    ),
    d: "M-14 56-30-8 0-56 30-8 14 56ZM0-56v48M-8 2a8 8 0 1 0 16 0a8 8 0 1 0-16 0",
  },
  book: {
    ground: "#473318",
    line: "#6B4E25",
    figure: "#FFD66B",
    pattern: repeat(9, (k) =>
      repeat(
        6,
        (j) =>
          `<path d="M${k * 80 + (j % 2) * 40 - 40} ${j * 70 - 10}l28 28-28 28-28-28z"/>`,
      ),
    ),
    d: "M0-40c-16-10-40-10-56-4v80c16-6 40-6 56 4 16-10 40-10 56-4v-80c-16-6-40-6-56 4ZM0-40v84",
  },
  shield: {
    ground: "#2A2D44",
    line: "#40445F",
    figure: "#B4B9CC",
    pattern: repeat(
      10,
      (k) =>
        `<path d="M-20 ${k * 40}${repeat(34, (j) => `l20 ${j % 2 ? -20 : 20}`)}"/>`,
    ),
    d: "M0-56 50-38v36c0 30-22 48-50 60-28-12-50-30-50-60v-36ZM-20 0l14 14 26-28",
  },
};

/** A calendar leaf: the figure of an event whose organiser chose no cover */
const PLAIN =
  "M-46-34h92v84h-92ZM-46-8h92M-22-50v28M22-50v28M-22 18h12M10 18h12";

/**
 * The drawing of a cover as SVG markup (16:9)
 * @param plain Keep the ground and pattern, with a calendar leaf in place
 * of the figure: says "an event" and nothing about its topic
 */
export function coverSvg(kind: CoverKind, plain = false): string {
  const art = ART[kind];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${art.ground}"/>` +
    `<g fill="none" stroke="${art.line}" stroke-width="2">${art.pattern}</g>` +
    `<g transform="translate(170 ${HEIGHT / 2}) scale(1.35)" fill="none" stroke="${art.figure}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="${plain ? PLAIN : art.d}"/></g>` +
    `</svg>`
  );
}

/** The drawn cover an event without a picture shows: the same one every time */
export function coverKindFor(eventId: string): CoverKind {
  let sum = 0;
  for (let index = 0; index < eventId.length; index++) {
    sum = (sum * 31 + eventId.charCodeAt(index)) >>> 0;
  }
  return COVER_KINDS[sum % COVER_KINDS.length];
}

/**
 * A ready cover as a picture file, to upload as the event's cover (so every
 * client shows the cover the organiser chose)
 */
export async function coverFile(kind: CoverKind): Promise<File> {
  const source = URL.createObjectURL(
    new Blob([coverSvg(kind)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.width = WIDTH * 2;
    image.height = HEIGHT * 2;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("cover drawing failed"));
      image.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("cover drawing failed")),
        "image/webp",
        0.92,
      ),
    );
    return new File([blob], `event-cover-${kind}.webp`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(source);
  }
}

/** One drawn cover, filling its box */
export function DrawnCover(props: { kind: CoverKind; plain?: boolean }) {
  // our own static drawing: no outside text reaches this markup
  // eslint-disable-next-line solid/no-innerhtml
  return <Drawn innerHTML={coverSvg(props.kind, props.plain)} />;
}

/**
 * The cover of an event: the organiser's picture, or the drawn cover that
 * belongs to this event. Fills its parent; decoration only.
 */
export function EventCover(props: {
  event: Pick<API.ServerEvent, "_id" | "cover">;
}) {
  const client = useClient();
  const picture = () =>
    props.event.cover
      ? new StoatFile(client(), props.event.cover).createFileURL()
      : undefined;

  return (
    <Show
      when={picture()}
      fallback={<DrawnCover kind={coverKindFor(props.event._id)} plain />}
    >
      <Picture src={picture()} alt="" loading="lazy" />
    </Show>
  );
}

const Drawn = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    "& svg": { display: "block", width: "100%", height: "100%" },
  },
});

const Picture = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    background: "var(--z-bg-input)",
  },
});
