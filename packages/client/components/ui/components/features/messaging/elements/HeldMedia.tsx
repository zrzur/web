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
