import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { Dialog } from "@revolt/ui";
import {
  ProfileEffect,
  useEffectsAllowed,
} from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";
import { isCommunityRef } from "@revolt/ui/components/features/profiles/userStyle";
import { effectStillUrl } from "@revolt/ui/components/features/profiles/userStyleExtras";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Choose a profile effect: the creator's effect you wear, or none. Every
 * effect is a creator's, put on from Designs. Tiles are still pictures; the
 * one you point at, focus or pick plays in the preview, once.
 */
export function EffectDialog(props: {
  show: boolean;
  onClose: () => void;
  value?: string;
  /** file of an uploaded effect that is on now */
  file?: string;
  onApply: (effect: string | undefined) => void;
}) {
  const label = useEffectLabels();
  const allowed = useEffectsAllowed();
  const instance = useInstance();
  /* eslint-disable solid/reactivity */
  const [choice, setChoice] = createSignal<string | undefined>(props.value);
  const [playing, setPlaying] = createSignal<string | undefined>(props.value);
  /* eslint-enable solid/reactivity */
  const [play, setPlay] = createSignal(0);

  /** the creator's effect you wear: kept, or taken off with None */
  const worn = () => (isCommunityRef(props.value) ? props.value : undefined);
  const still = () => {
    const url = effectStillUrl(instance.mediaUrl, props.file);
    return url ? (
      <StillPicture src={url} alt="" draggable={false} />
    ) : undefined;
  };

  function preview(id: string) {
    setPlaying(id);
    setPlay((n) => n + 1);
  }

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Profile effect</Trans>}
      width={720}
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "secondary" },
        {
          text: <Trans>Apply</Trans>,
          onClick: () => props.onApply(choice()),
        },
      ]}
    >
      <Layout>
        <Picker>
          <Grid>
            <Tile
              type="button"
              aria-pressed={!choice()}
              onClick={() => {
                setChoice(undefined);
                setPlaying(undefined);
              }}
            >
              <Art>
                <Icon name="prohibit" size={24} />
              </Art>
              <span>
                <Trans>No effect</Trans>
              </span>
            </Tile>
            <Show when={worn()}>
              {(id) => (
                <Tile
                  type="button"
                  data-testid="effect-worn"
                  aria-pressed={choice() === id()}
                  onClick={() => {
                    setChoice(id());
                    preview(id());
                  }}
                  onMouseEnter={() => preview(id())}
                  onFocus={() => preview(id())}
                >
                  <Art>{still()}</Art>
                  <span>{label(id())}</span>
                </Tile>
              )}
            </Show>
          </Grid>
          <Note>
            <Trans>
              More designs by creators are in Designs. Put one on there and it
              shows here.
            </Trans>
          </Note>
        </Picker>
        <Preview>
          <Stage data-testid="effect-preview">
            <ProfileEffect
              effect={playing()}
              file={props.file}
              play={play()}
              idle={playing() ? still() : undefined}
            />
          </Stage>
          <strong>{label(choice())}</strong>
          <Show
            when={allowed()}
            fallback={
              <small>
                <Trans>
                  Effects are off on this device, so the preview stays still.
                  Other people still see yours.
                </Trans>
              </small>
            }
          >
            <small>
              <Trans>
                Plays once when someone opens your profile, for up to 4 seconds.
              </Trans>
            </small>
          </Show>
        </Preview>
      </Layout>
    </Dialog>
  );
}

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const StillPicture = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
  },
});

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 200px",
    gap: "16px",
    "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Picker = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
    gap: "8px",
  },
});

const Tile = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "4px",
    borderRadius: "var(--z-radius, 10px)",
    border: "2px solid transparent",
    background: "var(--z-bg-input)",
    font: "inherit",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    _hover: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "&[aria-pressed='true']": {
      borderColor: "var(--z-accent)",
      color: "var(--z-fg-primary)",
    },
  },
});

const Art = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    height: "72px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "var(--z-bg-app)",
    color: "var(--z-icon-muted)",
    "--z-icon-color": "currentColor",
  },
});

const Preview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "13px",
    "& small": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Stage = styled("div", {
  base: {
    position: "relative",
    height: "240px",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    background: "var(--z-bg-app)",
    "@media (max-width: 600px)": { height: "160px" },
  },
});
