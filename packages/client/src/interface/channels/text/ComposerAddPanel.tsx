import { type JSX, For } from "solid-js";

import { styled } from "styled-system/jsx";

import { type IconName, Icon } from "@revolt/ui/icons/Icon";

/**
 * Phones: what the "+" of the message box offers, as tiles inside the panel
 * docked under the message box (the one the emoji picker opens in; owner,
 * 2026-11-18). The camera, the pictures and the files tiles open the phone's
 * own camera and pickers: a web app cannot read the photo library itself.
 */
export interface AddChoice {
  id: string;
  icon: IconName;
  label: string;
  onPick: () => void;
  testId?: string;
}

export function ComposerAddPanel(props: { choices: AddChoice[] }): JSX.Element {
  return (
    <Grid data-composer-add-panel>
      <For each={props.choices}>
        {(choice) => (
          <Tile
            type="button"
            data-add={choice.id}
            data-testid={choice.testId}
            onClick={choice.onPick}
          >
            <Icon name={choice.icon} size={24} />
            <span>{choice.label}</span>
          </Tile>
        )}
      </For>
    </Grid>
  );
}

const Grid = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridAutoRows: "84px",
    alignContent: "start",
    gap: "8px",
    padding: "16px",
  },
});

const Tile = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minWidth: 0,
    padding: "8px",
    border: "none",
    borderRadius: "14px",
    background:
      "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.35,
    textAlign: "center",
    cursor: "pointer",
    "& > span": {
      maxWidth: "100%",
      // two lines at most
      maxHeight: "2.7em",
      overflow: "hidden",
      overflowWrap: "anywhere",
    },
    _active: {
      background: "var(--z-nav-selected)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});
