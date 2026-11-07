import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Dialog } from "@revolt/ui";
import {
  EffectStill,
  ProfileEffect,
  useEffectsAllowed,
} from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import {
  EFFECT_IDS,
  EffectId,
  isEffectId,
} from "@revolt/ui/components/features/profiles/effects/effectIds";
import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Choose a profile effect. Tiles are still pictures; only the one you point
 * at, focus or pick plays in the preview, once, one at a time.
 */
export function EffectDialog(props: {
  show: boolean;
  onClose: () => void;
  value?: string;
  /** file of an uploaded effect that is on now */
  file?: string;
  onApply: (effect: string | undefined) => void;
}) {
  const { t } = useLingui();
  const label = useEffectLabels();
  const allowed = useEffectsAllowed();
  // eslint-disable-next-line solid/reactivity
  const [choice, setChoice] = createSignal<string | undefined>(props.value);
  const [playing, setPlaying] = createSignal<string | undefined>(props.value);
  const [play, setPlay] = createSignal(0);
  const [search, setSearch] = createSignal("");

  const matches = createMemo(() => {
    const words = search().trim().toLowerCase();
    return EFFECT_IDS.filter(
      (id) =>
        !words || label(id).toLowerCase().includes(words) || id.includes(words),
    );
  });

  function preview(id: EffectId) {
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
          <Search
            type="search"
            placeholder={t`Search effects`}
            aria-label={t`Search effects`}
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
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
            <For each={matches()}>
              {(id) => (
                <Tile
                  type="button"
                  data-testid={`effect-${id}`}
                  aria-pressed={choice() === id}
                  onClick={() => {
                    setChoice(id);
                    preview(id);
                  }}
                  onMouseEnter={() => preview(id)}
                  onFocus={() => preview(id)}
                >
                  <Art>
                    <EffectStill effect={id} />
                  </Art>
                  <span>{label(id)}</span>
                </Tile>
              )}
            </For>
          </Grid>
          <Show when={!matches().length}>
            <Empty>
              <Trans>No effects match your search.</Trans>
            </Empty>
          </Show>
        </Picker>
        <Preview>
          <Stage data-testid="effect-preview">
            <ProfileEffect
              effect={playing()}
              file={props.file}
              play={play()}
              idle={
                isEffectId(playing()) ? (
                  <EffectStill effect={playing() as EffectId} />
                ) : undefined
              }
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

const Search = styled("input", {
  base: {
    height: "40px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    font: "inherit",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
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

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "24px 0",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});
