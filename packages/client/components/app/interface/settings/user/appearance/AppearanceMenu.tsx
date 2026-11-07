import {
  type UnicodeEmojiPacks,
  isEmojiPackAvailable,
  UNICODE_EMOJI_PACKS,
  UnicodeEmoji,
} from "@revolt/markdown/emoji/UnicodeEmoji";
import { For, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import {
  FloatingSelect,
  MenuItem,
  Segmented,
  SettingsRow,
  SettingsSection,
  Slider,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  APPEARANCE_PRESETS,
  LISTED_THEME_PRESETS,
} from "@revolt/ui/themes/appearancePresets";
import {
  FONT_KEYS,
  FONTS,
  Fonts,
  MONOSPACE_FONT_KEYS,
  MONOSPACE_FONTS,
  MonospaceFonts,
} from "@revolt/ui/themes/fonts";
import { AnimationSettings } from "./AnimationSettings";
import { MyThemes } from "./MyThemes";

/**
 * Action accents only — chrome icons stay muted outline. Raspberry is the
 * default; Electric Violet (the default until 2026-11-01) stays a choice.
 */
const ACCENTS = [
  "#E0195F",
  "#9075FF",
  "#FF5BA8",
  "#4F5DFF",
  "#6B9CFF",
  "#3DBFB8",
  "#3DCF8E",
  "#E8B44C",
  "#E07A4F",
  "#E06B6B",
  "#9AA4B8",
];

/**
 * Appearance Studio, top to bottom:
 * theme (4 packs and 3 library themes) and mode → accent → layout → fonts → emoji →
 * animations → saved themes. Icons are fixed Outline (Kontur).
 */
export function AppearanceMenu() {
  const state = useState();
  const { t } = useLingui();

  const presets = [...APPEARANCE_PRESETS, ...LISTED_THEME_PRESETS].filter(
    (p) => p.id !== "custom",
  );

  const presetText = (id: string, name: string, description: string) =>
    ({
      "signature-dark": {
        name: t`Midnight Pulse`,
        description: t`Gaming dark: deep midnight panels, Raspberry for actions and Neon Pink for highlights.`,
      },
      graphite: {
        name: t`Graphite`,
        description: t`Cool graphite panels for long sessions. Same raspberry actions and pink highlights.`,
      },
      amoled: {
        name: t`AMOLED`,
        description: t`Near-black for OLED screens. Soft steps so the eye stays comfortable.`,
      },
      daylight: {
        name: t`Daylight`,
        description: t`Clean light surfaces with deep ink text and Raspberry actions.`,
      },
      "high-contrast": {
        name: t`High Contrast`,
        description: t`Pure black and white with a bright accent, larger text, clear focus rings and underlined links, for low vision and bright screens.`,
      },
      paper: {
        name: t`Paper`,
        description: t`A calm light theme in soft paper tones for bright rooms and daytime reading.`,
      },
      "desert-dawn": {
        name: t`Desert Dawn`,
        description: t`A warm dark theme in sand and copper tones, easy on the eyes in the evening.`,
      },
    })[id] ?? { name, description };

  function setAccent(colour: string) {
    state.theme.setM3Accent(colour);
    state.theme.setAppearancePreset("custom");
  }

  const emojiPacks = () =>
    UNICODE_EMOJI_PACKS.filter((pack) => isEmojiPackAvailable(pack));

  return (
    <Page>
      <SettingsSection
        title={<Trans>Theme</Trans>}
        description={
          <Trans>
            Pick a look, then fine-tune accent, layout and fonts below.
          </Trans>
        }
      >
        <ThemeLibrary role="radiogroup" aria-label={t`Theme`}>
          <ThemeGrid>
            <For each={presets}>
              {(preset) => {
                const active = () => state.theme.appearancePreset === preset.id;
                const text = () =>
                  presetText(preset.id, preset.name, preset.description);
                return (
                  <ThemeTile
                    type="button"
                    role="radio"
                    aria-checked={active()}
                    aria-label={text().name}
                    title={text().description || text().name}
                    onClick={() => state.theme.applyAppearancePreset(preset)}
                  >
                    <Thumb
                      style={{
                        "--t-app": preset.swatches[0],
                        "--t-sidebar": preset.swatches[1],
                        "--t-chat": preset.swatches[2],
                        "--t-raised": preset.swatches[3],
                        "--t-accent": preset.accent,
                        "--t-line":
                          preset.mode === "light"
                            ? "rgba(21,24,32,0.14)"
                            : "rgba(238,241,247,0.14)",
                      }}
                    >
                      <i class="rail" />
                      <i class="side">
                        <b />
                        <b />
                        <b />
                      </i>
                      <i class="chat">
                        <b />
                        <b />
                        <s />
                      </i>
                    </Thumb>
                    <TileName>
                      <span>{text().name}</span>
                      <Show
                        when={active()}
                        fallback={
                          <Dots aria-hidden="true">
                            <i style={{ background: preset.accent }} />
                            <For each={preset.dots ?? []}>
                              {(dot) => <i style={{ background: dot }} />}
                            </For>
                          </Dots>
                        }
                      >
                        <Check aria-hidden="true">
                          <Icon name="check" size={12} styleVariant="outline" />
                        </Check>
                      </Show>
                    </TileName>
                  </ThemeTile>
                );
              }}
            </For>
          </ThemeGrid>
        </ThemeLibrary>
        <SettingsRow
          icon={<Icon name="circle-half" size={20} />}
          title={<Trans>Mode</Trans>}
          description={
            <Trans>System follows your device's light or dark setting.</Trans>
          }
          control={(ids) => (
            <Segmented
              aria-labelledby={ids.labelId}
              value={state.theme.mode}
              onChange={(v) => state.theme.setMode(v)}
              options={[
                {
                  value: "dark",
                  label: <Trans>Dark</Trans>,
                  icon: <Icon name="moon" size={16} />,
                },
                {
                  value: "light",
                  label: <Trans>Light</Trans>,
                  icon: <Icon name="sun" size={16} />,
                },
                {
                  value: "system",
                  label: <Trans>System</Trans>,
                  icon: <Icon name="monitor" size={16} />,
                },
              ]}
            />
          )}
        />
      </SettingsSection>

      <SettingsSection
        title={<Trans>Colours</Trans>}
        description={
          <Trans>
            Accent colours actions and selection. Outline icons stay muted.
          </Trans>
        }
      >
        <SettingsRow
          icon={<Icon name="palette" size={20} />}
          title={<Trans>Accent colour</Trans>}
          description={
            <Trans>Buttons, switches, links and selected items.</Trans>
          }
          control={() => (
            <Swatches
              colours={ACCENTS}
              value={state.theme.m3Accent}
              onPick={setAccent}
              customLabel={t`Custom accent colour`}
              swatchLabel={(c) => t`Accent ${c}`}
            />
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Layout and text</Trans>}>
        <SettingsRow
          icon={<Icon name="list" size={20} />}
          title={<Trans>Density</Trans>}
          description={<Trans>How much space lists and messages use.</Trans>}
          control={(ids) => (
            <Segmented
              aria-labelledby={ids.labelId}
              value={state.theme.density ?? "comfortable"}
              onChange={(v) => state.theme.setDensity(v)}
              options={[
                { value: "compact", label: <Trans>Compact</Trans> },
                { value: "comfortable", label: <Trans>Comfortable</Trans> },
                { value: "spacious", label: <Trans>Spacious</Trans> },
              ]}
            />
          )}
        />
        <SettingsRow
          icon={<Icon name="text-aa" size={20} />}
          title={<Trans>Message text size</Trans>}
          control={() => (
            <SliderBox>
              <Slider
                aria-label={t`Message text size`}
                min={12}
                max={20}
                value={state.theme.messageSize}
                labelFormatter={(v) => `${v}px`}
                onInput={(event) =>
                  (state.theme.messageSize = Number(event.currentTarget.value))
                }
              />
            </SliderBox>
          )}
        />
        <SettingsRow
          icon={<Icon name="square" size={20} />}
          title={<Trans>Corner rounding</Trans>}
          control={() => (
            <SliderBox>
              <Slider
                aria-label={t`Corner rounding`}
                min={4}
                max={16}
                value={state.theme.radius}
                labelFormatter={(v) => `${v}px`}
                onInput={(event) =>
                  state.theme.setRadius(Number(event.currentTarget.value))
                }
              />
            </SliderBox>
          )}
        />
        <SettingsRow
          icon={<Icon name="sparkle" size={20} />}
          title={<Trans>Transparency and blur</Trans>}
          description={
            <Trans>
              Frosted menus and overlays. Turn off on older computers.
            </Trans>
          }
          onClick={() => state.theme.toggleBlur()}
          control={(ids) => (
            <Toggle
              checked={state.theme.blur}
              onChange={() => state.theme.toggleBlur()}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Fonts</Trans>}>
        <SettingsRow
          icon={<Icon name="text-t" size={20} />}
          title={<Trans>Interface font</Trans>}
          control={(ids) => (
            <SelectBox>
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={state.theme.interfaceFont}
                onChange={(e) =>
                  state.theme.setInterfaceFont(e.currentTarget.value as Fonts)
                }
                onOpened={() => {
                  for (const f in FONTS) FONTS[f as Fonts].load();
                }}
              >
                <For each={FONT_KEYS}>
                  {(key) => (
                    <MenuItem value={key} style={{ "font-family": key }}>
                      {key}
                    </MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </SelectBox>
          )}
        />
        <SettingsRow
          icon={<Icon name="code" size={20} />}
          title={<Trans>Code font</Trans>}
          control={(ids) => (
            <SelectBox>
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={state.theme.monospaceFont}
                onChange={(e) =>
                  state.theme.setMonospaceFont(
                    e.currentTarget.value as MonospaceFonts,
                  )
                }
                onOpened={() => {
                  for (const f in MONOSPACE_FONTS)
                    MONOSPACE_FONTS[f as MonospaceFonts].load();
                }}
              >
                <For each={MONOSPACE_FONT_KEYS}>
                  {(key) => (
                    <MenuItem value={key} style={{ "font-family": key }}>
                      {key}
                    </MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </SelectBox>
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Emoji</Trans>}>
        <SettingsRow
          icon={<Icon name="smiley" size={20} />}
          title={<Trans>Emoji style</Trans>}
          description={
            <EmojiSample>
              <For each={["😀", "❤️", "👋🏽", "🎮", "🎉"]}>
                {(emoji) => (
                  <UnicodeEmoji
                    emoji={emoji}
                    pack={state.settings.getValue("appearance:unicode_emoji")}
                  />
                )}
              </For>
            </EmojiSample>
          }
          control={(ids) => (
            <SelectBox>
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={
                  state.settings.getValue("appearance:unicode_emoji") ??
                  "fluent-flat"
                }
                onChange={(event) =>
                  state.settings.setValue(
                    "appearance:unicode_emoji",
                    event.currentTarget.value as UnicodeEmojiPacks,
                  )
                }
              >
                <For each={emojiPacks()}>
                  {(pack) => (
                    <MenuItem value={pack}>
                      {
                        {
                          system: t`System emoji`,
                          "fluent-flat": "Fluent Flat",
                          "fluent-color": "Fluent Color",
                          "fluent-3d": "Fluent 3D",
                          twemoji: "Twemoji Classic",
                          noto: "Noto Color",
                        }[pack]
                      }
                    </MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </SelectBox>
          )}
        />
      </SettingsSection>

      <AnimationSettings />

      <SettingsSection
        title={<Trans>Saved themes</Trans>}
        description={
          <Trans>
            Save your current look to switch back to it later, or share it as a
            file.
          </Trans>
        }
      >
        <PanelPad>
          <MyThemes />
        </PanelPad>
      </SettingsSection>
    </Page>
  );
}

/**
 * Accent swatches plus a custom colour well
 */
function Swatches(props: {
  colours: string[];
  value: string;
  onPick: (colour: string) => void;
  customLabel: string;
  swatchLabel: (colour: string) => string;
}) {
  let input!: HTMLInputElement;
  const isCustom = () =>
    !!props.value &&
    !props.colours.some((c) => c.toLowerCase() === props.value.toLowerCase());

  return (
    <SwatchRow role="radiogroup">
      <For each={props.colours}>
        {(colour) => (
          <Swatch
            type="button"
            role="radio"
            aria-checked={colour.toLowerCase() === props.value?.toLowerCase()}
            aria-label={props.swatchLabel(colour)}
            style={{ "--swatch": colour }}
            onClick={() => props.onPick(colour)}
          />
        )}
      </For>
      <Swatch
        type="button"
        role="radio"
        data-custom
        aria-checked={isCustom()}
        aria-label={props.customLabel}
        title={props.customLabel}
        style={{ "--swatch": isCustom() ? props.value : "transparent" }}
        onClick={() => input.click()}
      >
        <Show when={!isCustom()}>
          <Icon name="plus" size={12} styleVariant="outline" />
        </Show>
      </Swatch>
      <input
        ref={input}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        value={props.value || "#E0195F"}
        onInput={(e) => props.onPick(e.currentTarget.value)}
        style={{
          position: "absolute",
          opacity: 0,
          width: "1px",
          height: "1px",
          "pointer-events": "none",
        }}
      />
    </SwatchRow>
  );
}

const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
});

const ThemeLibrary = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "14px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const ThemeGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))",
    gap: "10px",
  },
});

/** The theme's accent, highlight and link colours */
const Dots = styled("span", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    gap: "3px",
    "& i": {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
    },
  },
});

const ThemeTile = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "6px",
    border: "1px solid var(--z-btn-surface-border)",
    borderRadius: "10px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "start",
    transition: "border-color 0.12s ease, background-color 0.12s ease",

    "&:hover": {
      background: "var(--z-nav-hover)",
      borderColor: "var(--z-border-strong)",
    },
    "&[aria-checked='true']": {
      color: "var(--z-fg-primary)",
      borderColor: "var(--z-accent)",
      boxShadow: "0 0 0 1px var(--z-accent)",
    },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/**
 * Tiny window thumbnail drawn from the preset's own palette
 */
const Thumb = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "12% 30% 1fr",
    height: "60px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "var(--t-app)",
    border: "1px solid var(--t-line)",

    "& i": { display: "flex", flexDirection: "column", gap: "4px" },
    "& .rail": { background: "var(--t-app)" },
    "& .side": {
      padding: "8px 5px",
      background: "var(--t-sidebar)",
      "& b": {
        height: "4px",
        borderRadius: "2px",
        background: "var(--t-line)",
      },
      "& b:first-child": { background: "var(--t-accent)", opacity: 0.85 },
    },
    "& .chat": {
      padding: "8px 6px",
      justifyContent: "flex-end",
      background: "var(--t-chat)",
      "& b": {
        height: "4px",
        width: "70%",
        borderRadius: "2px",
        background: "var(--t-line)",
      },
      "& b + b": { width: "45%" },
      "& s": {
        height: "8px",
        marginTop: "2px",
        borderRadius: "3px",
        background: "var(--t-raised)",
      },
    },
  },
});

const TileName = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px",
    paddingInline: "2px",
    fontSize: "13px",
    fontWeight: 500,
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Check = styled("span", {
  base: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "var(--z-accent-fill, var(--z-accent))",
    "--z-icon-color": "var(--z-on-accent)",
  },
});

const SwatchRow = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "6px",
    maxWidth: "min(320px, 48vw)",
  },
});

const Swatch = styled("button", {
  base: {
    width: "22px",
    height: "22px",
    padding: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    background: "var(--swatch)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
    transition: "box-shadow 0.12s ease, transform 0.12s ease",
    "--z-icon-color": "var(--z-fg-secondary)",

    "&:hover": { transform: "scale(1.08)" },
    "&[aria-checked='true']": {
      boxShadow:
        "0 0 0 2px var(--z-bg-sidebar), 0 0 0 4px var(--swatch, var(--z-fg-primary))",
    },
    "&[data-custom]": {
      border: "1px dashed var(--z-fg-muted)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "3px",
    },
  },
});

const EmojiSample = styled("span", {
  base: {
    display: "inline-flex",
    gap: "8px",
    marginTop: "4px",
    "--emoji-size": "20px",
  },
});

const PanelPad = styled("div", {
  base: {
    padding: "14px",
  },
});

const SliderBox = styled("div", {
  base: { width: "min(240px, 40vw)" },
});

const SelectBox = styled("div", {
  base: { width: "min(220px, 38vw)" },
});
