import { Trans, useLingui } from "@lingui/solid/macro";
import {
  ColourPicker,
  Dialog,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Slider,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { For, Index, Show, createSignal } from "solid-js";
import type { LobbyAppearance, ServerLobby } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { lobbyColour } from "./lobbyAppearance";

/**
 * Lobby design settings, one titled section per topic (look, colours,
 * layout, sizes, what the lobby shows) so each sits on its own panel like
 * every other settings page. Caller: LobbySettings.tsx.
 */
export function LobbyAppearanceEditor(props: {
  lobby: ServerLobby;
  onAccent: (value: string) => void;
  onChange: (value: LobbyAppearance) => void;
}) {
  const { t } = useLingui();
  const [picking, setPicking] = createSignal<
    "text" | "accent" | "background" | "secondary" | "surface"
  >();
  const appearance = () => props.lobby.appearance ?? {};
  const set = <K extends keyof LobbyAppearance>(
    key: K,
    value: LobbyAppearance[K],
  ) => props.onChange({ ...appearance(), [key]: value });
  const setColour = (
    key: "accent" | "secondary" | "background" | "surface" | "text",
    value: string,
  ) => {
    if (key === "accent") props.onAccent(value);
    else set(key, value || undefined);
  };
  const colourFields = () =>
    [
      { key: "accent", label: t`Accent colour`, value: props.lobby.accent },
      {
        key: "secondary",
        label: t`Gradient colour`,
        value: appearance().secondary,
      },
      {
        key: "background",
        label: t`Page background`,
        value: appearance().background,
      },
      {
        key: "surface",
        label: t`Card background`,
        value: appearance().surface,
      },
      { key: "text", label: t`Text colour`, value: appearance().text },
    ] as const;
  const ranges = () =>
    [
      {
        key: "blend",
        label: t`Colour intensity`,
        min: 0,
        max: 100,
        fallback: 28,
        format: (n: number) => `${n}%`,
      },
      {
        key: "angle",
        label: t`Gradient angle`,
        min: 0,
        max: 360,
        fallback: 120,
        format: (n: number) => `${n}°`,
      },
      {
        key: "banner_height",
        label: t`Banner height`,
        min: 100,
        max: 360,
        fallback: 208,
        format: (n: number) => `${n}px`,
      },
      {
        key: "radius",
        label: t`Corner radius`,
        min: 0,
        max: 28,
        fallback: 14,
        format: (n: number) => `${n}px`,
      },
      {
        key: "channel_limit",
        label: t`Channels shown`,
        min: 1,
        max: 9,
        fallback: 6,
        format: (n: number) => String(n),
      },
      {
        key: "newcomer_limit",
        label: t`New members shown`,
        min: 1,
        max: 24,
        fallback: 12,
        format: (n: number) => String(n),
      },
    ] as const;
  const toggles = () =>
    [
      {
        key: "show_greeting",
        icon: "hand-waving",
        label: t`Personal greeting`,
        line: t`Welcome, name! above the cards.`,
      },
      {
        key: "show_member_count",
        icon: "users-three",
        label: t`Member count`,
        line: t`How many people are in the server.`,
      },
      {
        key: "show_chat",
        icon: "chat-circle",
        label: t`Open chat button`,
        line: t`Takes people straight to the conversation.`,
      },
      {
        key: "show_invite",
        icon: "user-plus",
        label: t`Invite people button`,
        line: t`Lets members invite their friends.`,
      },
    ] as const;

  const presets = () =>
    [
      { name: t`Raspberry`, accent: "#E0195F", secondary: "#FF7AA8" },
      { name: t`Violet`, accent: "#9075FF", secondary: "#D462B3" },
      { name: t`Ocean`, accent: "#64A9FF", secondary: "#55DCC8" },
      { name: t`Sunset`, accent: "#F3B96B", secondary: "#F27488" },
    ] as const;
  const same = (a?: string, b?: string) =>
    (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
  const usesAppTheme = () =>
    !props.lobby.accent && Object.keys(appearance()).length === 0;

  return (
    <>
      <SettingsSection
        title={<Trans>Design</Trans>}
        description={
          <Trans>
            Make the lobby yours. Everything here shows in the lobby after
            saving.
          </Trans>
        }
      >
        <Themes aria-label={t`Colour presets`}>
          <For each={presets()}>
            {(preset) => (
              <Theme
                type="button"
                aria-pressed={
                  same(props.lobby.accent, preset.accent) &&
                  same(appearance().secondary, preset.secondary)
                }
                onClick={() => {
                  props.onAccent(preset.accent);
                  set("secondary", preset.secondary);
                }}
              >
                <ThemeSwatch
                  style={{
                    background: `linear-gradient(135deg, ${preset.accent}, ${preset.secondary})`,
                  }}
                />
                <ThemeName title={preset.name}>
                  <span>{preset.name}</span>
                  <Icon name="check-circle" size={16} />
                </ThemeName>
              </Theme>
            )}
          </For>
          <Theme
            type="button"
            aria-pressed={usesAppTheme()}
            onClick={() => {
              props.onAccent("");
              props.onChange({});
            }}
          >
            <ThemeSwatch data-app />
            <ThemeName title={t`App theme`}>
              <span>{t`App theme`}</span>
              <Icon name="check-circle" size={16} />
            </ThemeName>
          </Theme>
        </Themes>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Colours</Trans>}
        description={
          <Trans>
            Empty fields follow the theme. Text keeps 4.5:1 contrast.
          </Trans>
        }
      >
        <Index each={colourFields()}>
          {(field) => (
            <ColourRow>
              <ColourName>{field().label}</ColourName>
              <SwatchButton
                type="button"
                aria-label={t`Pick ${field().label}`}
                style={{
                  background:
                    lobbyColour(field().value) ??
                    (field().key === "background"
                      ? "#1D1F2D"
                      : field().key === "surface"
                        ? "#242638"
                        : field().key === "text"
                          ? "#F0F1F8"
                          : "#E0195F"),
                }}
                onClick={() => setPicking(field().key)}
              />
              <HexField
                aria-label={t`${field().label} hex`}
                type="text"
                maxlength={7}
                placeholder={t`Automatic`}
                value={field().value ?? ""}
                spellcheck={false}
                onInput={(e) => setColour(field().key, e.currentTarget.value)}
              />
              <IconBtn
                type="button"
                aria-label={t`Reset ${field().label}`}
                title={t`Reset`}
                disabled={!field().value}
                onClick={() => setColour(field().key, "")}
              >
                <Icon name="arrow-counter-clockwise" size={18} />
              </IconBtn>
            </ColourRow>
          )}
        </Index>
        <Show when={picking()}>
          {(key) => (
            <Dialog
              show
              size="sm"
              onClose={() => setPicking(undefined)}
              title={colourFields().find((f) => f.key === key())?.label}
              actions={[{ text: <Trans>Done</Trans> }]}
            >
              <ColourPicker
                label={colourFields().find((f) => f.key === key())?.label}
                colour={
                  lobbyColour(
                    colourFields().find((f) => f.key === key())?.value,
                  ) ?? null
                }
                onChange={(colour) => setColour(key(), colour ?? "")}
              />
            </Dialog>
          )}
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Layout</Trans>}>
        <SettingsRow
          icon={<Icon name="squares-four" size={20} />}
          title={<Trans>Arrangement</Trans>}
          description={
            <Trans>Cards in two columns or one below the other.</Trans>
          }
          control={() => (
            <SelectWidth>
              <FloatingSelect
                aria-label={t`Arrangement`}
                value={appearance().layout ?? "Split"}
                onChange={(e) =>
                  set(
                    "layout",
                    e.currentTarget.value as LobbyAppearance["layout"],
                  )
                }
              >
                <MenuItem value="Split">{t`Main column and sidebar`}</MenuItem>
                <MenuItem value="Single">{t`Single column`}</MenuItem>
              </FloatingSelect>
            </SelectWidth>
          )}
        />
        <SettingsRow
          icon={<Icon name="arrows-out-line-vertical" size={20} />}
          title={<Trans>Spacing</Trans>}
          description={<Trans>Room between cards and inside them.</Trans>}
          control={() => (
            <SelectWidth>
              <FloatingSelect
                aria-label={t`Spacing`}
                value={appearance().density ?? "Comfortable"}
                onChange={(e) =>
                  set(
                    "density",
                    e.currentTarget.value as LobbyAppearance["density"],
                  )
                }
              >
                <MenuItem value="Comfortable">{t`Comfortable`}</MenuItem>
                <MenuItem value="Compact">{t`Compact`}</MenuItem>
              </FloatingSelect>
            </SelectWidth>
          )}
        />
        <SettingsRow
          icon={<Icon name="image" size={20} />}
          title={<Trans>Banner</Trans>}
          description={<Trans>The picture at the top of the lobby.</Trans>}
          control={() => (
            <SelectWidth>
              <FloatingSelect
                aria-label={t`Banner`}
                value={appearance().banner_mode ?? "Server"}
                onChange={(e) =>
                  set(
                    "banner_mode",
                    e.currentTarget.value as LobbyAppearance["banner_mode"],
                  )
                }
              >
                <MenuItem value="Server">{t`Server banner`}</MenuItem>
                <MenuItem value="Gradient">{t`Colour gradient`}</MenuItem>
                <MenuItem value="Hidden">{t`Hidden`}</MenuItem>
              </FloatingSelect>
            </SelectWidth>
          )}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Sizes</Trans>}>
        <For each={ranges()}>
          {(range) => (
            <RangeRow>
              <RangeLabel>{range.label}</RangeLabel>
              <Slider
                aria-label={range.label}
                min={range.min}
                max={range.max}
                value={appearance()[range.key] ?? range.fallback}
                labelFormatter={range.format}
                onInput={(e) => set(range.key, e.currentTarget.value)}
              />
            </RangeRow>
          )}
        </For>
      </SettingsSection>

      <SettingsSection title={<Trans>Shown in the lobby</Trans>}>
        <For each={toggles()}>
          {(toggle) => (
            <SettingsRow
              icon={<Icon name={toggle.icon} size={20} />}
              title={toggle.label}
              description={toggle.line}
              onClick={() =>
                set(toggle.key, appearance()[toggle.key] === false)
              }
              control={(ids) => (
                <Toggle
                  checked={appearance()[toggle.key] !== false}
                  onChange={(checked) => set(toggle.key, checked)}
                  aria-labelledby={ids.labelId}
                />
              )}
            />
          )}
        </For>
      </SettingsSection>
    </>
  );
}

const Themes = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    padding: "16px",
    _phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

const Theme = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    padding: "8px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "12px",
    background: "color-mix(in srgb, var(--z-fg-primary) 3%, transparent)",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "border-color 0.12s ease, background 0.12s ease",
    "--z-icon-color": "var(--z-accent)",
    "& .z-icon": { opacity: 0, transition: "opacity 0.12s ease" },
    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-pressed=true]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 10%, transparent)",
    },
    "&[aria-pressed=true] .z-icon": { opacity: 1 },
    _motionReduce: { transition: "none" },
  },
});

const ThemeSwatch = styled("span", {
  base: {
    display: "block",
    height: "48px",
    borderRadius: "8px",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, white 10%, transparent)",
    "&[data-app]": {
      background:
        "linear-gradient(135deg, var(--z-bg-rail, #0D0E16), var(--z-bg-chat, #1D1F2D) 60%, var(--z-accent, #E0195F))",
    },
  },
});

const ThemeName = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minWidth: 0,
    paddingInline: "4px",
    fontSize: "13px",
    fontWeight: 600,
    // long names (German "Sonnenuntergang") end in "…" instead of touching the edge
    "& > :first-child": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& > svg": { flexShrink: 0 },
  },
});

const ColourRow = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 32px minmax(96px, 128px) 36px",
    gap: "12px",
    alignItems: "center",
    minHeight: "56px",
    paddingBlock: "8px",
    paddingInline: "16px",
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInlineStart: "16px",
      insetInlineEnd: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr) 32px minmax(80px, 1fr) 44px",
    },
  },
});

const ColourName = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
  },
});

const SwatchButton = styled("button", {
  base: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "1px solid var(--z-border-subtle)",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, black 25%, transparent)",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
    _phone: { width: "44px", height: "44px" },
  },
});

const HexField = styled("input", {
  base: {
    minWidth: 0,
    minHeight: "36px",
    paddingInline: "10px",
    borderRadius: "var(--z-shape-control, 10px)",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    fontFamily: "inherit",
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-field-focus-shadow)",
      borderColor: "color-mix(in srgb, var(--z-accent) 45%, transparent)",
    },
    _phone: { minHeight: "44px", fontSize: "16px" },
  },
});

const IconBtn = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    padding: 0,
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    _hover: {
      color: "var(--z-fg-primary)",
      background: "var(--z-nav-hover)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _disabled: {
      opacity: 0.35,
      cursor: "default",
      _hover: { background: "transparent", color: "var(--z-fg-muted)" },
    },
    _phone: { width: "44px", height: "44px" },
  },
});

/** [label] [slider ......... value] on one line, hairlines like SettingsRow */
const RangeRow = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) minmax(0, 2fr)",
    gap: "16px",
    alignItems: "center",
    minHeight: "56px",
    paddingBlock: "8px",
    paddingInline: "16px",
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInlineStart: "16px",
      insetInlineEnd: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
      paddingBlock: "12px",
    },
  },
});

const RangeLabel = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
  },
});

const SelectWidth = styled("div", {
  base: { width: "min(220px, 40vw)" },
});
