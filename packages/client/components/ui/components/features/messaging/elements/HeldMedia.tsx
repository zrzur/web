import { JSX, Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  type HeldKind,
  markLoadedByTap,
  shortSize,
  wasLoadedByTap,
} from "@revolt/common/lib/saveData";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Save data: a picture or GIF that waits for a tap. Until then nothing of
 * it is downloaded: the children are not in the page at all. The
 * placeholder takes the full rectangle of its parent (the reserved media
 * box), says what waits and how big it is, and one tap or Enter loads it.
 *
 * With `preview` (a media server that makes small previews) the placeholder
 * is that small still picture, with the size on a chip in its corner; a GIF
 * carries a play mark, so it is not taken for a photo.
 */
export function HeldMedia(props: {
  /** Whether to hold it back at all (the caller asks `saveData.ts`) */
  held: boolean;
  kind: HeldKind;
  /** Stays loaded when the message is drawn again in this visit */
  id?: string;
  /** Size of the file in bytes, when known */
  size?: number;
  /** A small square (link preview thumbnail): the icon alone */
  compact?: boolean;
  /**
   * Its own size in px, where no media box is reserved around it (pictures
   * of link cards); never wider than the card
   */
  frame?: { width: number; height: number };
  /** Address of the small still preview shown until the tap */
  preview?: string;
  children: JSX.Element;
}) {
  const { t } = useLingui();
  const [tapped, setTapped] = createSignal(false);
  const waiting = () => props.held && !tapped() && !wasLoadedByTap(props.id);

  const label = () => (props.kind === "gif" ? t`Play GIF` : t`Load picture`);
  const size = () => shortSize(props.size);

  return (
    <Show when={waiting()} fallback={props.children}>
      <Tile
        type="button"
        data-tap-to-load={props.kind}
        data-compact={props.compact ? "" : undefined}
        data-preview={props.preview ? "" : undefined}
        aria-label={size() ? `${label()} (${size()})` : label()}
        style={
          props.frame
            ? {
                width: `${props.frame.width}px`,
                height: `${props.frame.height}px`,
                "max-width": "100%",
                "flex-shrink": 0,
              }
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          markLoadedByTap(props.id);
          setTapped(true);
        }}
      >
        <Show
          when={props.preview}
          fallback={
            <>
              <Mark aria-hidden="true">
                <Icon
                  name={props.kind === "gif" ? "gif" : "image"}
                  size={props.compact ? 20 : 24}
                />
              </Mark>
              <Show when={!props.compact}>
                <Words>
                  <span>{label()}</span>
                  <Show when={size()}>
                    {/* a size reads left to right in every language */}
                    <Size dir="ltr">{size()}</Size>
                  </Show>
                </Words>
              </Show>
            </>
          }
        >
          <Still
            src={props.preview}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          <Show when={props.kind === "gif" && !props.compact}>
            <Play aria-hidden="true">
              <Icon name="play" size={24} filled />
            </Play>
          </Show>
          <Show when={!props.compact && (size() || props.kind === "gif")}>
            <Chip aria-hidden="true">
              <Icon name={props.kind === "gif" ? "gif" : "image"} size={16} />
              <Show when={size()}>
                <span dir="ltr">{size()}</span>
              </Show>
            </Chip>
          </Show>
        </Show>
      </Tile>
    </Show>
  );
}

const Tile = styled("button", {
  base: {
    containerType: "size",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    padding: "12px",
    boxSizing: "border-box",
    overflow: "hidden",
    cursor: "pointer",
    font: "inherit",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-soft)",
    borderRadius: "var(--borderRadius-md)",
    transition: "background 120ms ease",
    "&:hover": {
      background: "var(--z-hover)",
    },
    "&:active": {
      background: "var(--z-hover)",
      borderColor: "var(--z-border-strong)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    "&[data-compact]": {
      padding: "4px",
    },
    // the small preview fills the tile; the frame is the picture's own
    "&[data-preview]": {
      position: "relative",
      padding: 0,
      border: "none",
    },
  },
});

const Still = styled("img", {
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "inherit",
  },
});

/** How big the full picture is, in the corner the text starts from */
const Chip = styled("span", {
  base: {
    position: "absolute",
    insetInlineStart: "8px",
    bottom: "8px",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    maxWidth: "calc(100% - 16px)",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-floating)",
    border: "1px solid var(--z-border-soft)",
    // a very small picture has no room for it
    "@container (max-width: 95px)": { display: "none" },
    "@container (max-height: 47px)": { display: "none" },
  },
});

/** A GIF waits: the mark people know from every player */
const Play = styled("span", {
  base: {
    // in the middle of the picture, whatever lays the tile out
    position: "absolute",
    inset: 0,
    margin: "auto",
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    borderRadius: "999px",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-floating)",
    border: "1px solid var(--z-border-soft)",
    "@container (max-width: 95px)": { display: "none" },
    "@container (max-height: 95px)": { display: "none" },
  },
});

const Mark = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    color: "var(--z-fg-secondary)",
  },
});

const Words = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    maxWidth: "100%",
    textAlign: "center",
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 500,
    // a very small picture has room for the icon only
    "@container (max-width: 119px)": { display: "none" },
    "@container (max-height: 87px)": { display: "none" },
  },
});

const Size = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 400,
    color: "var(--z-fg-secondary)",
  },
});
