import { For, JSX, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { itemBox } from "./ProfileCard";
import { tilesShown, useProfileSize } from "./profileSize";

export type ProfileTile = {
  key: string;
  name: string;
  /** The muted line under the name */
  note: JSX.Element;
  picture: JSX.Element;
  onPress: () => void;
};

/**
 * Equal tiles side by side: the real picture on top, the name, a muted line.
 * Their creations and Wearing both draw through this, on the card and the
 * full profile, so the two can never differ.
 */
export function ProfileTiles(props: { tiles: ProfileTile[]; all?: boolean }) {
  const size = useProfileSize();
  return (
    <Grid style={{ "--tiles": tilesShown(size()) }}>
      <For
        each={
          props.all ? props.tiles : props.tiles.slice(0, tilesShown(size()))
        }
      >
        {(tile) => (
          <button
            class={itemBox({ tile: true, press: true })}
            type="button"
            title={tile.name}
            onClick={tile.onPress}
          >
            <Picture>{tile.picture}</Picture>
            <span class={caption()}>
              <bdi>{tile.name}</bdi>
              <span>{tile.note}</span>
            </span>
          </button>
        )}
      </For>
    </Grid>
  );
}

/** Show more on the title line, then Show less. Only with more than a row. */
export function ProfileTilesMore(props: {
  count: number;
  open: boolean;
  /** It leads to a page of its own, so it says See all */
  leaves?: boolean;
  onPress: () => void;
}) {
  const size = useProfileSize();
  return (
    <Show when={props.count > tilesShown(size())}>
      <More
        type="button"
        aria-expanded={props.leaves ? undefined : props.open}
        onClick={props.onPress}
      >
        <Show when={!props.leaves} fallback={<Trans>See all</Trans>}>
          <Show when={props.open} fallback={<Trans>Show more</Trans>}>
            <Trans>Show less</Trans>
          </Show>
        </Show>
      </More>
    </Show>
  );
}

/** A nameplate in a tile: the whole plate at its real shape, never cropped */
export const TilePlate = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: "var(--z-radius-sm, 6px)",
  },
});

const More = styled("button", {
  base: {
    flexShrink: 0,
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--profile-accent, var(--z-accent-text, var(--z-accent)))",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(var(--tiles, 3), minmax(0, 1fr))",
    gap: "8px",
  },
});

const Picture = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "48px",
    "& img": {
      width: "100%",
      height: "100%",
      objectFit: "contain",
    },
  },
});

const caption = cva({
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    flex: 1,
    justifyContent: "space-between",
    gap: "4px",
    fontSize: "12px",
    lineHeight: "16px",
    textAlign: "center",
    "& bdi": {
      display: "block",
      maxWidth: "100%",
      // one line, cut at its end: a name never breaks inside a word
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: 600,
      color: "var(--profile-ink, var(--z-fg-primary))",
    },
    // the muted line stays on one line, inside the tile's padding
    "& > span": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: "var(--profile-ink-2, var(--z-fg-muted))",
    },
  },
});
