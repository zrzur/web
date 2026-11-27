import { For, Index, JSX, Show, createEffect, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { ColourWell } from "@revolt/ui/components/design/ColourWell";
import {
  NAME_GRADIENTS,
  NAME_SOLIDS,
  NAME_SPECTRA,
} from "@revolt/ui/components/features/profiles/nameStyles";
import {
  type NameEffect,
  NAME_EFFECTS,
  NAME_FONTS,
  NAME_MAX_COLOURS,
  UserStyle,
  nameStyle,
} from "@revolt/ui/components/features/profiles/userStyle";
import { THEME_PRESETS } from "@revolt/ui/components/features/profiles/userStyleExtras";
import { Icon } from "@revolt/ui/icons/Icon";

import { useNameFontLabel, useStyleLabels } from "./styleLabels";

export { useNameFontLabel, useStyleLabels };

const sameColours = (a?: string[], b?: string[]) =>
  (a ?? []).join() === (b ?? []).join();

/**
 * Profile theme: twelve ready-made gradients, or two colours of your own
 */
export function ThemePicker(props: {
  value: string[] | undefined;
  onChange: (colours: string[] | undefined) => void;
}) {
  const { t } = useLingui();
  const labels = useStyleLabels();
  const first = () => props.value?.[0] ?? "#E0195F";
  const second = () => props.value?.[1];

  return (
    <ThemeWrap>
      <CustomRow>
        <ColourWell
          label={t`Main colour`}
          value={first()}
          onInput={(colour) =>
            props.onChange([colour, ...(second() ? [second()!] : [])])
          }
        />
        <Show
          when={second()}
          fallback={
            <TextButton
              type="button"
              onClick={() => props.onChange([first(), "#1d1f2b"])}
            >
              <Icon name="plus" size={14} />
              <Trans>Second colour</Trans>
            </TextButton>
          }
        >
          <ColourWell
            label={t`Second colour`}
            value={second()!}
            onInput={(colour) => props.onChange([first(), colour])}
          />
        </Show>
        <TextButton
          type="button"
          disabled={!props.value?.length}
          onClick={() => props.onChange(undefined)}
        >
          <Trans>None</Trans>
        </TextButton>
      </CustomRow>
      <Presets>
        <For each={THEME_PRESETS}>
          {(preset) => (
            <Preset
              type="button"
              aria-pressed={sameColours(props.value, preset.colours)}
              style={{
                background: `linear-gradient(135deg, ${preset.colours[0]}, ${preset.colours[1]})`,
              }}
              onClick={() => props.onChange([...preset.colours])}
            >
              <span>{labels.theme(preset.id)}</span>
            </Preset>
          )}
        </For>
      </Presets>
    </ThemeWrap>
  );
}

/** Colour modes, by how many colours each one uses */
type NameMode = "none" | "solid" | "gradient" | "spectrum";
const modeOf = (count: number): NameMode =>
  count >= 3
    ? "spectrum"
    : count === 2
      ? "gradient"
      : count === 1
        ? "solid"
        : "none";

/**
 * Display name style: font, colour (none, one, gradient or a spectrum of
 * three to five), and an effect on top, with a live preview in the viewer's
 * own theme. On a phone the preview stays pinned above the choices.
 */
export function NameStyleForm(props: {
  name: string;
  value: UserStyle;
  onChange: (
    style: Pick<UserStyle, "name_font" | "name_colour" | "name_effect">,
  ) => void;
}) {
  const { t, i18n } = useLingui();
  const fontLabel = useNameFontLabel();
  // the look itself is the state: every choice shows at once, in the
  // profile preview too, and Save keeps it
  const font = () => props.value.name_font ?? "default";
  const colour = () =>
    (props.value.name_colour ?? []).slice(0, NAME_MAX_COLOURS);
  const effect = () => props.value.name_effect;
  const change = (
    next: Partial<{ font: string; colour: string[]; effect?: string }>,
  ) => {
    const f = "font" in next ? next.font! : font();
    props.onChange({
      name_font: f === "default" ? undefined : f,
      name_colour: "colour" in next ? next.colour! : colour(),
      name_effect: "effect" in next ? next.effect : effect(),
    });
  };
  const setFont = (value: string) => change({ font: value });
  const setColour = (value: string[]) => change({ colour: value });
  const setEffect = (value: string | undefined) => change({ effect: value });

  const mode = () => modeOf(colour().length);
  const look = () =>
    nameStyle(
      { name_font: font(), name_colour: colour(), name_effect: effect() },
      { always: true, moving: true },
    );
  const sample = () => (i18n().locale === "ar" ? "زر" : "Gg");

  const modes = (): { id: NameMode; label: string }[] => [
    { id: "none", label: t`None` },
    { id: "solid", label: t`Solid` },
    { id: "gradient", label: t`Gradient` },
    { id: "spectrum", label: t`Spectrum` },
  ];
  const effects = (): { id: NameEffect | undefined; label: string }[] => [
    { id: undefined, label: t`No effect` },
    { id: "halo", label: t`Halo` },
    { id: "edge", label: t`Edge` },
    { id: "lifted", label: t`Lifted` },
    { id: "sheen", label: t`Sheen` },
  ];
  const presets = () =>
    mode() === "solid"
      ? NAME_SOLIDS.map((c) => [c])
      : mode() === "gradient"
        ? NAME_GRADIENTS.map((g) => [...g])
        : NAME_SPECTRA;

  function pickMode(next: NameMode) {
    const now = colour();
    if (next === "none") setColour([]);
    else if (next === "solid") setColour([now[0] ?? NAME_SOLIDS[0]]);
    else if (next === "gradient")
      setColour(now.length === 2 ? now : [...NAME_GRADIENTS[0]]);
    else setColour(now.length >= 3 ? now : [...NAME_SPECTRA[0]]);
  }

  function surprise() {
    const pick = <T,>(list: readonly T[]) =>
      list[Math.floor(Math.random() * list.length)];
    const roll = Math.random();
    change({
      font: pick(NAME_FONTS).id,
      colour:
        roll < 0.35
          ? [pick(NAME_SOLIDS)]
          : roll < 0.7
            ? [...pick(NAME_GRADIENTS)]
            : [...pick(NAME_SPECTRA)],
      effect: Math.random() < 0.6 ? pick(NAME_EFFECTS) : undefined,
    });
  }

  return (
    <NsForm>
      {/* your name as it looks now, above the choices */}
      <NsLine>
        <strong style={look()} data-name-preview>
          <bdi>{props.name}</bdi>
        </strong>
        <NsReset
          type="button"
          onClick={() =>
            change({ font: "default", colour: [], effect: undefined })
          }
        >
          <Trans>Reset</Trans>
        </NsReset>
      </NsLine>

      <NsSection>
        <NsLabel>
          <Trans>Choose font</Trans>
        </NsLabel>
        <NsFonts>
          <For each={NAME_FONTS}>
            {(option) => (
              <NsFont
                type="button"
                aria-pressed={font() === option.id}
                onClick={() => setFont(option.id)}
                style={nameStyle({ name_font: option.id }, { always: true })}
                title={fontLabel(option.id)}
                aria-label={fontLabel(option.id)}
              >
                {sample()}
              </NsFont>
            )}
          </For>
        </NsFonts>
      </NsSection>

      <NsSection>
        <NsLabel>
          <Trans>Choose colour</Trans>
        </NsLabel>
        <NsModes role="group">
          <For each={modes()}>
            {(option) => (
              <NsMode
                type="button"
                aria-pressed={mode() === option.id}
                onClick={() => pickMode(option.id)}
              >
                {option.label}
              </NsMode>
            )}
          </For>
        </NsModes>

        <Show when={mode() !== "none"}>
          <NsStops>
            <Index each={colour()}>
              {(value, index) => (
                <ColourWell
                  label={
                    index === 0
                      ? t`Pick a colour`
                      : index === 1
                        ? t`Second colour`
                        : t`Colour ${index + 1}`
                  }
                  value={value()}
                  onInput={(picked) =>
                    setColour(
                      colour().map((c, at) => (at === index ? picked : c)),
                    )
                  }
                />
              )}
            </Index>
            <Show when={mode() === "spectrum"}>
              <NsStopButtons>
                <Show when={colour().length > 3}>
                  <NsStopButton
                    type="button"
                    aria-label={t`Remove the last colour`}
                    title={t`Remove the last colour`}
                    onClick={() => setColour(colour().slice(0, -1))}
                  >
                    <Icon name="minus" size={18} />
                  </NsStopButton>
                </Show>
                <Show when={colour().length < NAME_MAX_COLOURS}>
                  <NsStopButton
                    type="button"
                    aria-label={t`Add a colour`}
                    title={t`Add a colour`}
                    onClick={() =>
                      setColour([
                        ...colour(),
                        NAME_SOLIDS[(colour().length * 5) % NAME_SOLIDS.length],
                      ])
                    }
                  >
                    <Icon name="plus" size={18} />
                  </NsStopButton>
                </Show>
              </NsStopButtons>
            </Show>
          </NsStops>

          <NsPresets data-mode={mode()}>
            <For each={presets()}>
              {(option) => (
                <NsPreset
                  type="button"
                  aria-label={option.join(" → ")}
                  aria-pressed={sameColours(colour(), option)}
                  onClick={() => setColour([...option])}
                >
                  <span
                    style={{
                      background:
                        option.length >= 2
                          ? `linear-gradient(90deg, ${option.join(", ")})`
                          : option[0],
                    }}
                  />
                </NsPreset>
              )}
            </For>
          </NsPresets>
        </Show>
      </NsSection>

      <NsSection>
        <NsLabel>
          <Trans>Choose effect</Trans>
        </NsLabel>
        <NsEffects>
          <For each={effects()}>
            {(option) => (
              <NsEffect
                type="button"
                aria-pressed={effect() === option.id}
                onClick={() => setEffect(option.id)}
                data-effect={option.id ?? "none"}
              >
                <b
                  aria-hidden="true"
                  style={nameStyle(
                    {
                      name_font: "bold",
                      name_colour: colour().length
                        ? colour()
                        : ["#6dd5ed", "#b794ff"],
                      name_effect: option.id,
                    },
                    { always: true },
                  )}
                >
                  {sample()}
                </b>
                <span>{option.label}</span>
              </NsEffect>
            )}
          </For>
        </NsEffects>
        <Show when={effect() === "edge" && colour().length >= 2}>
          <NsNote>
            <Trans>
              Edge: the first colour fills the letters, the second draws the
              border.
            </Trans>
          </NsNote>
        </Show>
      </NsSection>

      <NsSurprise type="button" onClick={surprise}>
        <Icon name="sparkle" size={18} />
        <Trans>Surprise me</Trans>
      </NsSurprise>
      <NsNote>
        <Trans>
          In a server, a role colour wins over yours, but your font and effect
          stay. On light themes your colours are darkened a little so the name
          stays readable.
        </Trans>
      </NsNote>
    </NsForm>
  );
}

/**
 * Heart in the corner of a gallery tile: saves the item to favourites.
 * A span so it can sit inside the tile's button.
 */
export function FavouriteButton(props: {
  active: boolean;
  onToggle: () => void;
}) {
  const { t } = useLingui();
  const toggle = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    props.onToggle();
  };
  return (
    <Heart
      role="button"
      tabIndex={0}
      data-active={props.active}
      aria-pressed={props.active}
      aria-label={
        props.active ? t`Remove from favourites` : t`Add to favourites`
      }
      title={props.active ? t`Remove from favourites` : t`Add to favourites`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") toggle(e);
      }}
    >
      <Icon name="heart" size={14} filled={props.active} />
    </Heart>
  );
}

/**
 * One row of the Look section. It opens in place: the row stays, its arrow
 * turns, and the choices grow under it inside the same list, with the
 * profile preview beside them changing as you pick. One row is open at a
 * time; the row again (or Esc) closes it.
 */
export function LookItem(props: {
  id: string;
  icon: JSX.Element;
  title: JSX.Element;
  value: JSX.Element;
  open: boolean;
  onToggle: () => void;
  children: JSX.Element;
}) {
  let row: HTMLButtonElement | undefined;
  // the opened row comes into view, its choices with it
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open)
          requestAnimationFrame(() =>
            row?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
          );
      },
      { defer: true },
    ),
  );
  return (
    <LookEntry data-open={props.open ? "" : undefined}>
      <Row
        ref={row}
        type="button"
        id={`look-${props.id}`}
        aria-expanded={props.open}
        aria-controls={`look-${props.id}-panel`}
        onClick={() => props.onToggle()}
      >
        <RowIcon>{props.icon}</RowIcon>
        <span data-text>
          <strong>{props.title}</strong>
          <small>{props.value}</small>
        </span>
        <Icon name="caret-down" size={16} class="caret" />
      </Row>
      <Drawer
        id={`look-${props.id}-panel`}
        role="region"
        aria-labelledby={`look-${props.id}`}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          props.onToggle();
          row?.focus();
        }}
      >
        <div class="inner">
          {/* built when first opened, and kept while open */}
          <Show when={props.open}>
            <div class="content">{props.children}</div>
          </Show>
        </div>
      </Drawer>
    </LookEntry>
  );
}

/** A row and its drawer; the open one is set apart from the others */
const LookEntry = styled("div", {
  base: {
    "& + &": { borderTop: "1px solid var(--z-border-subtle)" },
    "&[data-open]": { background: "var(--z-box-bg)" },
    "&[data-open] .caret": { transform: "rotate(180deg)" },
  },
});

/** The choices under an open row: they grow open, no box over the page */
const Drawer = styled("div", {
  base: {
    display: "grid",
    gridTemplateRows: "0fr",
    transition: "grid-template-rows 220ms cubic-bezier(0.2, 0, 0, 1)",
    "[data-open] > &": { gridTemplateRows: "1fr" },
    "& > .inner": { overflow: "hidden", minHeight: 0 },
    "& .content": {
      padding: "4px 14px 16px",
      animation: "zFadeIn 220ms ease both",
    },
    _motionReduce: { transition: "none", "& .content": { animation: "none" } },
  },
});

const ThemeWrap = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const CustomRow = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "10px" },
});

const TextButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "34px",
    paddingInline: "10px",
    border: "none",
    borderRadius: "var(--z-radius, 10px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    "&:active": { background: "var(--z-nav-selected)" },
    _disabled: { opacity: 0.45, cursor: "default", background: "transparent" },
  },
});

const Presets = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "8px",
    maxHeight: "min(260px, 40dvh)",
    overflowY: "auto",
    padding: "4px",
  },
});

const Preset = styled("button", {
  base: {
    position: "relative",
    height: "46px",
    display: "flex",
    alignItems: "flex-end",
    padding: "6px 9px",
    border: "2px solid transparent",
    borderRadius: "var(--z-radius, 10px)",
    color: "#fff",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 700,
    textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
    cursor: "pointer",
    transition: "transform 0.12s ease",
    _hover: { transform: "translateY(-1px)" },
    "&[aria-pressed='true']": {
      borderColor: "#fff",
      boxShadow: "0 0 0 2px var(--z-accent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/* ---- display-name style: its own parts ---- */

/** one column on a phone; the preview beside the choices on wider screens */
const NS_NARROW = "@media (max-width: 720px)";

/** Your name as styled now, with Reset beside it */
const NsLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    padding: "8px 14px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-bg-app)",
    "& > strong": {
      flex: 1,
      minWidth: 0,
      fontSize: "20px",
      fontWeight: 600,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const NsReset = styled("button", {
  base: {
    flexShrink: 0,
    minHeight: "32px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "var(--z-radius-sm, 8px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { minHeight: "44px" },
  },
});

const NsForm = styled("div", {
  base: {
    gridColumn: "1",
    gridRow: "1",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    [NS_NARROW]: { gridRow: "2", paddingTop: "12px" },
  },
});

const NsSection = styled("section", {
  base: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
});

const NsLabel = styled("h3", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const nsTile = {
  border: "1px solid var(--z-border-subtle)",
  borderRadius: "10px",
  background: "var(--z-bg-input)",
  color: "var(--z-fg-primary)",
  cursor: "pointer",
  transition: "border-color 0.12s ease, background 0.12s ease",
  _hover: { borderColor: "var(--z-border-strong)" },
  "&[aria-pressed='true']": {
    borderColor: "var(--z-accent)",
    boxShadow: "inset 0 0 0 1px var(--z-accent)",
    background: "color-mix(in srgb, var(--z-accent) 10%, var(--z-bg-input))",
  },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
} as const;

const NsFonts = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "8px",
  },
});

const NsFont = styled("button", {
  base: { ...nsTile, height: "52px", padding: 0, fontSize: "20px" },
});

/** four equal parts in one row */
const NsModes = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
});

const NsMode = styled("button", {
  base: {
    ...nsTile,
    minHeight: "44px",
    paddingInline: "4px",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    [NS_NARROW]: { fontSize: "13px" },
  },
});

/** the chosen colours, then − and + for a spectrum */
const NsStops = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    // the wells are 44 px everywhere in this dialog
    "& > label": { width: "44px", height: "44px", borderRadius: "10px" },
  },
});

const NsStopButtons = styled("div", {
  base: { display: "flex", gap: "8px", marginInlineStart: "4px" },
});

const NsStopButton = styled("button", {
  base: {
    ...nsTile,
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    padding: 0,
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    _hover: {
      borderColor: "var(--z-border-strong)",
      color: "var(--z-fg-primary)",
    },
  },
});

/**
 * Ready-made colours. A desktop shows them all; a phone scrolls the row
 * sideways (its own scroll, never the page's).
 */
const NsPresets = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
    gap: "8px",
    "&[data-mode='gradient'], &[data-mode='spectrum']": {
      gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
    },
    [NS_NARROW]: {
      display: "flex",
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      scrollbarWidth: "none",
      marginInline: "-16px",
      paddingInline: "16px",
      paddingBlock: "2px",
      "&::-webkit-scrollbar": { display: "none" },
      "& > button": { flex: "0 0 44px" },
      "&[data-mode='gradient'] > button, &[data-mode='spectrum'] > button": {
        flex: "0 0 72px",
      },
    },
  },
});

/** 44 px to tap; the colour inside it */
const NsPreset = styled("button", {
  base: {
    height: "44px",
    padding: "4px",
    border: "2px solid transparent",
    borderRadius: "12px",
    background: "none",
    cursor: "pointer",
    "& > span": {
      display: "block",
      width: "100%",
      height: "100%",
      borderRadius: "8px",
      boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.08)",
    },
    "&[aria-pressed='true']": { borderColor: "var(--z-accent)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const NsEffects = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "8px",
    [NS_NARROW]: {
      display: "flex",
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      scrollbarWidth: "none",
      marginInline: "-16px",
      paddingInline: "16px",
      paddingBlock: "2px",
      "&::-webkit-scrollbar": { display: "none" },
      "& > button": { flex: "0 0 84px" },
    },
  },
});

const NsEffect = styled("button", {
  base: {
    ...nsTile,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    minHeight: "72px",
    padding: "8px 4px",
    font: "inherit",
    "& b": { fontSize: "22px", lineHeight: "28px" },
    "& span": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-secondary)",
      textAlign: "center",
    },
    "&[aria-pressed='true'] span": { color: "var(--z-fg-primary)" },
  },
});

const NsSurprise = styled("button", {
  base: {
    ...nsTile,
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    paddingInline: "16px",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    "--z-icon-color": "currentColor",
  },
});

const NsNote = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    "&[data-narrow]": { display: "none" },
    [NS_NARROW]: { "&[data-narrow]": { display: "block" } },
  },
});

const Row = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    // a row of one settings box: the box draws the border, rows a divider
    minHeight: "64px",
    padding: "12px 14px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: "var(--z-fg-primary)",
    transition: "background var(--z-motion-fast, 120ms) ease",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    "& > [data-text]": {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    },
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    "& .caret": {
      flexShrink: 0,
      transition: "transform 200ms ease",
    },
  },
});

const RowIcon = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "38px",
    height: "38px",
    flexShrink: 0,
  },
});

/** Heart on a gallery tile; shows on hover, stays when saved */
export const Heart = styled("span", {
  base: {
    position: "absolute",
    top: "6px",
    insetInlineStart: "6px",
    display: "grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "rgb(0 0 0 / 45%)",
    color: "#fff",
    cursor: "pointer",
    opacity: 0,
    transition: "opacity 0.12s ease, transform 0.12s ease",
    "--z-icon-color": "currentColor",
    "button:hover > &": { opacity: 1 },
    // touch has no hover: the heart is always there, and bigger
    "@media (hover: none)": { opacity: 1, width: "32px", height: "32px" },
    _focusVisible: { opacity: 1, outline: "2px solid var(--z-focus)" },
    _hover: { transform: "scale(1.08)" },
    "&[data-active='true']": { opacity: 1, color: "var(--z-accent-text)" },
  },
});
