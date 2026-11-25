import { Show, createEffect, createSignal, on } from "solid-js";

import { cva, cx } from "styled-system/css";

import { tileLetter } from "./activityText";

/**
 * The picture of a game or app: its own picture when there is one (a tall
 * cover keeps its shape on the profile), else a letter tile in Zrzur's
 * colours. A picture that fails to load turns into the tile, so a broken
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
        art({ size: props.size, tall: props.size === "card" && tall() }),
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
          class={picture()}
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

const art = cva({
  base: {
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "visible",
    background: "var(--z-accent-muted)",
    boxShadow: "inset 0 0 0 1px var(--profile-line, var(--z-border-subtle))",
    userSelect: "none",
  },
  variants: {
    size: {
      line: { width: "16px", height: "16px", borderRadius: "4px" },
      row: { width: "32px", height: "32px", borderRadius: "8px" },
      card: { width: "56px", height: "56px", borderRadius: "10px" },
    },
    // a cover (Steam's library art) stays a cover: 2:3, the same height
    tall: {
      true: { width: "40px" },
    },
  },
});

/* placed over the whole tile, so a picture of any shape fills exactly the
   tile and never sets its height */
const picture = cva({
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "inherit",
    display: "block",
  },
});

const letter = cva({
  base: {
    fontWeight: 700,
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
