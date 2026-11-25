import { Show, createEffect, createSignal, on } from "solid-js";

import { cva, cx } from "styled-system/css";

import { tileLetter } from "./activityText";

/**
 * The picture of a game or app, by itself: a logo with no tile or frame, a
 * tall cover as the picture with a small rounded corner, else the first
 * letter in a soft circle. A picture that fails to load turns into the letter, so a broken
 * image never shows. `src` must already be safe (Zrzur's own servers, the
 * image proxy, or a local icon from the desktop app).
 */
export function ActivityArt(props: {
  name: string;
  src?: string;
  size: "line" | "row" | "card";
  /** The small picture in the corner (an app's own `small_image`), card only */
  badge?: string;
  badgeTitle?: string;
  title?: string;
  class?: string;
}) {
  const [failed, setFailed] = createSignal(false);
  const [tall, setTall] = createSignal(false);
  const [badgeFailed, setBadgeFailed] = createSignal(false);
  // a new picture gets a new chance
  createEffect(
    on(
      () => props.src,
      () => {
        setFailed(false);
        setTall(false);
      },
    ),
  );
  createEffect(
    on(
      () => props.badge,
      () => setBadgeFailed(false),
    ),
  );

  return (
    <span
      class={cx(
        art({
          size: props.size,
          tall: tall(),
          letter: !props.src || failed(),
        }),
        props.class,
      )}
      title={props.title}
      data-testid="activity-art"
      data-kind={props.src && !failed() ? "picture" : "letter"}
      data-tall={tall() ? "" : undefined}
    >
      <Show
        when={props.src && !failed()}
        fallback={
          <span class={letter({ size: props.size })} aria-hidden="true">
            {tileLetter(props.name)}
          </span>
        }
      >
        <img
          src={props.src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          draggable={false}
          class={picture({
            tall: props.size !== "line" && tall(),
            crop: props.size === "line" && tall(),
          })}
          onLoad={(event) => {
            const img = event.currentTarget;
            setTall(img.naturalHeight > img.naturalWidth * 1.2);
          }}
          onError={() => setFailed(true)}
        />
      </Show>
      <Show when={props.size === "card" && props.badge && !badgeFailed()}>
        <img
          src={props.badge}
          alt=""
          title={props.badgeTitle}
          loading="lazy"
          referrerpolicy="no-referrer"
          draggable={false}
          class={badge()}
          onError={() => setBadgeFailed(true)}
        />
      </Show>
    </span>
  );
}

/* no tile behind a picture: a logo stands by itself, a cover is the
   picture with a small rounded corner; only the letter gets a soft circle */
const art = cva({
  base: {
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "visible",
    userSelect: "none",
  },
  variants: {
    size: {
      line: { width: "16px", height: "16px" },
      row: { width: "32px", height: "32px" },
      card: { width: "56px", height: "56px" },
    },
    // a cover (Steam's library art) keeps its 2:3 shape inside the same
    // square, so names beside it line up with the rows around it
    tall: { true: {} },
    letter: {
      true: {
        borderRadius: "full",
        background: "color-mix(in srgb, var(--z-accent) 12%, transparent)",
      },
    },
  },
});

/* placed over the whole box, so a picture of any shape fits exactly and
   never sets its height. A hairline drop shadow in the text colour keeps a
   dark logo visible on a dark panel and a light one on a light panel. */
const picture = cva({
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    filter:
      "drop-shadow(0 0 1px color-mix(in srgb, var(--z-fg-primary) 55%, transparent)) drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))",
  },
  variants: {
    // a logo shown whole; an app icon keeps its own rounded shape
    tall: {
      false: { objectFit: "contain", borderRadius: "22%" },
      true: {
        objectFit: "cover",
        borderRadius: "4px",
        width: "auto",
        aspectRatio: "2 / 3",
        insetInline: "auto",
        marginInline: "auto",
      },
    },
    // too small for a whole cover: its middle, with a small rounded corner
    crop: { true: { objectFit: "cover", borderRadius: "3px" } },
  },
});

const letter = cva({
  base: {
    fontWeight: 600,
    color: "var(--z-accent-text)",
    lineHeight: 1,
  },
  variants: {
    size: {
      line: { fontSize: "10px" },
      row: { fontSize: "15px" },
      card: { fontSize: "22px" },
    },
  },
});

/* the corner picture sits on the tile's end corner, ringed by the panel */
const badge = cva({
  base: {
    position: "absolute",
    insetInlineEnd: "-4px",
    bottom: "-4px",
    width: "20px",
    height: "20px",
    borderRadius: "full",
    objectFit: "cover",
    border: "2px solid var(--profile-panel, var(--z-bg-raised))",
    background: "var(--profile-panel, var(--z-bg-raised))",
  },
});
