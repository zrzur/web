import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useStyleLabels } from "@revolt/app/interface/settings/user/profile/StyleEditors";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { Avatar } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import {
  NameplateMotion,
  useDesignMotion,
} from "@revolt/ui/components/features/profiles/NameplateMotion";
import {
  type UserStyle,
  DECORATIONS,
  NAMEPLATES,
  nameStyle,
  nameplateBackground,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";
import { useAccountGate } from "../../DesignsSite";

import { type Person, Face, WornAvatar, useWearer } from "./Scenes";

/** pink, the one accent of Designs */
const PINK = "var(--z-designs-pink)";

/**
 * Ready-made looks: a profile theme, a name font and colour, a decoration
 * and a nameplate that go together. Everything is built in, so a look is
 * worn in one tap and works for everyone.
 */
export type Look = {
  id: string;
  style: Required<
    Pick<
      UserStyle,
      "theme" | "name_font" | "name_colour" | "decoration" | "nameplate"
    >
  >;
};

export const LOOKS: Look[] = [
  {
    id: "night-glow",
    style: {
      theme: ["#3d1e6d", "#035aa6"],
      name_font: "bold",
      name_colour: ["#8e2de2", "#e100ff"],
      decoration: "star-orbit",
      nameplate: "midnight",
    },
  },
  {
    id: "golden-hour",
    style: {
      theme: ["#ff6b4a", "#ffb347"],
      name_font: "serif",
      name_colour: ["#ff9a44", "#ffcc33"],
      decoration: "sun-rays",
      nameplate: "sunset",
    },
  },
  {
    id: "deep-sea",
    style: {
      theme: ["#1e9bb8", "#6fd3e8"],
      name_font: "rounded",
      name_colour: ["#2193b0", "#6dd5ed"],
      decoration: "ice-crystal",
      nameplate: "ocean",
    },
  },
  {
    id: "fresh-mint",
    style: {
      theme: ["#11998e", "#38ef7d"],
      name_font: "rounded",
      name_colour: ["#38d39f"],
      decoration: "ivy",
      nameplate: "mint",
    },
  },
  {
    id: "blossom",
    style: {
      theme: ["#ff9a9e", "#fecfef"],
      name_font: "script",
      name_colour: ["#ff5c8a"],
      decoration: "hearts",
      nameplate: "sakura",
    },
  },
  {
    id: "ember",
    style: {
      theme: ["#eb3349", "#f45c43"],
      name_font: "wide",
      name_colour: ["#ff6b4a", "#a66bff"],
      decoration: "flame-ring",
      nameplate: "autumn",
    },
  },
  {
    id: "arcade",
    style: {
      theme: ["#0f2027", "#2c5364"],
      name_font: "pixel",
      name_colour: ["#3ec6e0"],
      decoration: "neon",
      nameplate: "midnight",
    },
  },
  {
    id: "storm",
    style: {
      theme: ["#00c6ff", "#0072ff"],
      name_font: "bold",
      name_colour: ["#ffffff"],
      decoration: "lightning",
      nameplate: "aurora",
    },
  },
  {
    id: "cosmos",
    style: {
      theme: ["#8b2be2", "#e0218a"],
      name_font: "wide",
      name_colour: ["#a66bff"],
      decoration: "moon-halo",
      nameplate: "zodiac-pisces",
    },
  },
  {
    id: "studio",
    style: {
      theme: ["#0f2027", "#2c5364"],
      name_font: "mono",
      name_colour: ["#ffffff"],
      decoration: "music-notes",
      nameplate: "midnight",
    },
  },
  {
    id: "victory",
    style: {
      theme: ["#f7971e", "#ffd200"],
      name_font: "serif",
      name_colour: ["#ffd200"],
      decoration: "laurel",
      nameplate: "sunset",
    },
  },
  {
    id: "winter",
    style: {
      theme: ["#2193b0", "#6dd5ed"],
      name_font: "rounded",
      name_colour: ["#ffffff"],
      decoration: "snow",
      nameplate: "clouds",
    },
  },
];

/** Moods for the look filter: which looks feel like what */
export const VIBES: { id: string; looks: string[] }[] = [
  { id: "all", looks: LOOKS.map((look) => look.id) },
  { id: "calm", looks: ["deep-sea", "fresh-mint", "winter", "blossom"] },
  { id: "bold", looks: ["ember", "arcade", "storm", "cosmos"] },
  { id: "warm", looks: ["golden-hour", "ember", "victory", "blossom"] },
  { id: "night", looks: ["night-glow", "cosmos", "studio", "arcade"] },
];

export function useVibeText() {
  const { t } = useLingui();
  const text: Record<string, string> = {
    all: t`All`,
    calm: t`Calm`,
    bold: t`Bold`,
    warm: t`Warm`,
    night: t`Night`,
  };
  return (id: string) => text[id] ?? id;
}

/** One line for a mood when it is shown as a collection */
export function useVibeLine() {
  const { t } = useLingui();
  const text: Record<string, string> = {
    calm: t`Soft colours for long evenings.`,
    bold: t`Loud, bright and hard to miss.`,
    warm: t`Sunset tones and a little gold.`,
    night: t`Made for the late shift.`,
  };
  return (id: string) => text[id] ?? "";
}

/** Translated look names and one-line descriptions */
export function useLookText() {
  const { t } = useLingui();
  const text: Record<string, [string, string]> = {
    "night-glow": [t`Night glow`, t`Violet light for late talks.`],
    "golden-hour": [t`Golden hour`, t`Warm sunset colours and a gold ring.`],
    "deep-sea": [t`Deep sea`, t`Cool blues with a touch of ice.`],
    "fresh-mint": [t`Fresh mint`, t`Light, green and full of sparkle.`],
    blossom: [t`Blossom`, t`Soft pink with hearts.`],
    ember: [t`Ember`, t`Bold reds and flames.`],
    arcade: [t`Arcade`, t`Pixel name and a neon ring.`],
    storm: [t`Storm`, t`Bright blue with lightning.`],
    cosmos: [t`Cosmos`, t`A galaxy around you.`],
    studio: [t`Studio`, t`Headphones on, music up.`],
    victory: [t`Victory`, t`Gold laurel for winners.`],
    winter: [t`Winter`, t`Snow and calm blue.`],
  };
  return (id: string) => text[id] ?? [id, ""];
}

const sameList = (a?: string[], b?: string[]) =>
  (a ?? []).join() === (b ?? []).join();

/** Whether the user's style is exactly this look */
export function isWearing(style: UserStyle | undefined, look: Look) {
  return (
    !!style &&
    sameList(style.theme, look.style.theme) &&
    style.name_font === look.style.name_font &&
    sameList(style.name_colour, look.style.name_colour) &&
    style.decoration === look.style.decoration &&
    style.nameplate === look.style.nameplate
  );
}

/** What the API accepts for a style (no file fields, no empty parts) */
export function sendableStyle(style: UserStyle): UserStyle {
  return {
    ...(style.theme?.length ? { theme: style.theme } : {}),
    ...(style.name_font ? { name_font: style.name_font } : {}),
    ...(style.name_colour?.length ? { name_colour: style.name_colour } : {}),
    ...(style.decoration ? { decoration: style.decoration } : {}),
    ...(style.nameplate ? { nameplate: style.nameplate } : {}),
    ...(style.effect ? { effect: style.effect } : {}),
    ...(style.effect && style.effect_file
      ? { effect_file: style.effect_file }
      : {}),
  };
}

/**
 * Wear a style (or part of one) and offer to go back: the previous style
 * is kept until something else is worn
 */
export function useWear() {
  const client = useClient();
  const signedIn = useAccountGate();
  const describeError = useError();
  const [busy, setBusy] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const [previous, setPrevious] = createSignal<UserStyle>();

  const current = () => userStyleOf(client().user);

  async function apply(key: string, style: UserStyle, remember = true) {
    if (!signedIn()) return;
    setBusy(key);
    setError(undefined);
    const before = current() ?? {};
    try {
      await client().user!.edit({
        style: sendableStyle(style),
      });
      if (remember) setPrevious(before);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(undefined);
    }
  }

  return {
    current,
    busy,
    error,
    canUndo: () => !!previous(),
    /** wear a whole look */
    look: (look: Look) => apply(look.id, look.style),
    /** change one part and keep the rest */
    part: (key: string, patch: Partial<UserStyle>) =>
      apply(key, { ...(current() ?? {}), ...patch }),
    undo: async () => {
      const style = previous();
      if (!style) return;
      await apply("undo", style, false);
      setPrevious(undefined);
    },
  };
}

/**
 * A profile card wearing a style: banner, avatar, name and nameplate. Used
 * at every size, so a design always shows on the real thing.
 */
export function StyleCard(props: {
  style: UserStyle;
  compact?: boolean;
  /** a large tile on a wall */
  feature?: boolean;
  /** someone from the cast; the wearer when left out */
  person?: Person;
}) {
  const instance = useInstance();
  const wearer = useWearer();
  const motion = useDesignMotion();
  const plate = () =>
    nameplateBackground(props.style, instance.mediaUrl, { moving: motion() });
  const theme = () => props.style.theme ?? ["#2a2c3d", "#1d1f2d"];

  return (
    <Card
      data-compact={props.compact ? "" : undefined}
      data-feature={props.feature ? "" : undefined}
    >
      <Banner
        style={{
          background: `linear-gradient(135deg, ${theme()[0]}, ${theme()[1] ?? theme()[0]})`,
        }}
      />
      <Body
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${theme()[0]} 14%, var(--z-designs-art-ground)), color-mix(in srgb, ${theme()[1] ?? theme()[0]} 10%, var(--z-designs-art-ground)))`,
        }}
      >
        <AvatarSpot data-spot>
          <WornAvatar
            size={props.feature ? 80 : 60}
            style={props.style}
            person={props.person}
          />
        </AvatarSpot>
        {/* the name as people see it, the handle under it */}
        <Who>
          <Name dir="auto" style={nameStyle(props.style)}>
            {wearer.who(props.person).name}
          </Name>
          <small dir="auto">@{wearer.who(props.person).handle}</small>
        </Who>
        <Show when={plate()}>
          <Plate
            class="z-plate"
            style={plate() ? { "--plate": plate() } : undefined}
          >
            <Face
              size={22}
              name={wearer.who(props.person).name}
              colour={wearer.who(props.person).colour}
              src={wearer.who(props.person).avatar}
            />
            <span dir="auto" style={nameStyle(props.style, { colour: false })}>
              {wearer.who(props.person).name}
            </span>
          </Plate>
        </Show>
      </Body>
    </Card>
  );
}

/** Grid of looks with a preview, a name, a line and a Wear button */
export function LookGrid(props: { looks?: Look[]; limit?: number }) {
  const wear = useWear();
  const text = useLookText();
  const looks = createMemo(() =>
    (props.looks ?? LOOKS).slice(0, props.limit ?? LOOKS.length),
  );

  return (
    <>
      <WearBar
        error={wear.error()}
        undo={wear.canUndo() ? wear.undo : undefined}
      />
      <Grid>
        <For each={looks()}>
          {(look) => {
            const wearing = () => isWearing(wear.current(), look);
            return (
              <Tile>
                <StyleCard style={look.style} />
                <TileText>
                  <strong>{text(look.id)[0]}</strong>
                  <span>{text(look.id)[1]}</span>
                </TileText>
                <WearButton
                  type="button"
                  data-wearing={wearing() ? "" : undefined}
                  disabled={wearing() || !!wear.busy()}
                  onClick={() => void wear.look(look)}
                >
                  <Show
                    when={wearing()}
                    fallback={
                      <Show
                        when={wear.busy() === look.id}
                        fallback={<Trans>Wear this look</Trans>}
                      >
                        <Trans>Wearing…</Trans>
                      </Show>
                    }
                  >
                    <Icon name="check" size={16} />
                    <Trans>You're wearing it</Trans>
                  </Show>
                </WearButton>
              </Tile>
            );
          }}
        </For>
      </Grid>
    </>
  );
}

/** Included decorations, each tried on the user's own avatar */
export function IncludedDecorations(props: { limit?: number }) {
  const wearer = useWearer();
  const wear = useWear();
  const labels = useStyleLabels();
  const list = () => DECORATIONS.slice(0, props.limit ?? DECORATIONS.length);

  return (
    <>
      <WearBar
        error={wear.error()}
        undo={wear.canUndo() ? wear.undo : undefined}
      />
      <SmallGrid>
        <For each={list()}>
          {(id) => {
            const wearing = () => wear.current()?.decoration === id;
            return (
              <PartTile
                type="button"
                aria-pressed={wearing()}
                disabled={!!wear.busy()}
                onClick={() =>
                  void wear.part(`d:${id}`, {
                    decoration: wearing() ? undefined : id,
                  })
                }
              >
                <PartStage>
                  <AvatarDecoration decoration={id} size={64}>
                    <Avatar size={64} src={wearer.avatar()} />
                  </AvatarDecoration>
                </PartStage>
                <span>{labels.decoration(id)}</span>
                <Show when={wearing()}>
                  <Worn>
                    <Icon name="check" size={12} />
                    <Trans>On</Trans>
                  </Worn>
                </Show>
              </PartTile>
            );
          }}
        </For>
      </SmallGrid>
    </>
  );
}

/** Included nameplates behind the user's own name */
export function IncludedNameplates(props: { limit?: number }) {
  const wearer = useWearer();
  const instance = useInstance();
  const wear = useWear();
  const labels = useStyleLabels();
  const list = () => NAMEPLATES.slice(0, props.limit ?? NAMEPLATES.length);

  return (
    <>
      <WearBar
        error={wear.error()}
        undo={wear.canUndo() ? wear.undo : undefined}
      />
      <PlateGrid>
        <For each={list()}>
          {(plate) => {
            const wearing = () => wear.current()?.nameplate === plate.id;
            return (
              <PlateTile
                type="button"
                aria-pressed={wearing()}
                disabled={!!wear.busy()}
                onClick={() =>
                  void wear.part(`n:${plate.id}`, {
                    nameplate: wearing() ? undefined : plate.id,
                  })
                }
              >
                <Plate
                  class="z-plate"
                  data-large
                  style={{
                    "--plate": nameplateBackground(
                      { nameplate: plate.id },
                      instance.mediaUrl,
                    ),
                  }}
                >
                  <NameplateMotion plate={plate.id} />
                  <Avatar size={28} src={wearer.avatar()} />
                  <span dir="auto">{wearer.name()}</span>
                </Plate>
                <PlateLabel>
                  <span>{labels.nameplate(plate.id)}</span>
                  <Show when={wearing()}>
                    <Worn>
                      <Icon name="check" size={12} />
                      <Trans>On</Trans>
                    </Worn>
                  </Show>
                </PlateLabel>
              </PlateTile>
            );
          }}
        </For>
      </PlateGrid>
    </>
  );
}

/** A line under a section after something was worn: errors, or Undo */
function WearBar(props: { error?: string; undo?: () => Promise<void> }) {
  return (
    <Show when={props.error || props.undo}>
      <Notice
        role={props.error ? "alert" : "status"}
        data-error={props.error ? "" : undefined}
      >
        <Show
          when={props.error}
          fallback={
            <>
              <Icon name="check-circle" size={16} />
              <span>
                <Trans>Your profile is updated.</Trans>
              </span>
              <button type="button" onClick={() => void props.undo?.()}>
                <Trans>Undo</Trans>
              </button>
            </>
          }
        >
          <Icon name="warning-circle" size={16} />
          <span>{props.error}</span>
        </Show>
      </Notice>
    </Show>
  );
}

/** Frosted glass shared by every tile on the Designs pages */
const tileSurface = {
  borderRadius: "var(--z-shape-card, 14px)",
  border: "1px solid var(--z-designs-edge)",
  background: "var(--z-designs-glass, var(--z-card-bg))",
  boxShadow: "var(--z-designs-glass-lift, var(--z-card-lift))",
} as const;

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
    gap: "16px",
  },
});

const Tile = styled("article", {
  base: {
    ...tileSurface,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
  },
});

const Card = styled("div", {
  base: {
    overflow: "hidden",
    borderRadius: "10px",
    border: "1px solid var(--z-designs-on-art-edge)",
    color: "var(--z-designs-on-art)",
    "&[data-feature] > div:first-child": { height: "120px" },
    "&[data-feature] > div:last-child": { paddingTop: "64px" },
    "&[data-feature] [data-spot]": { top: "-44px" },
    "&[data-compact] > div:first-child": { height: "48px" },
    "&[data-compact] > div:last-child": { padding: "40px 12px 12px" },
  },
});

const Banner = styled("div", { base: { height: "64px" } });

const Body = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "48px 14px 14px",
  },
});

const Who = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxWidth: "100%",
    minWidth: 0,
    "& > small": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-designs-on-art-muted)",
    },
  },
});

const AvatarSpot = styled("div", {
  base: {
    position: "absolute",
    insetInlineStart: "14px",
    top: "-34px",
    padding: "4px",
    borderRadius: "50%",
    background: "var(--z-designs-art-ground)",
  },
});

const Name = styled("div", {
  base: {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.25,
    color: "var(--z-designs-on-art)",
    // keeps coloured names readable on any banner colour
    textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
  },
});

const Plate = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    aspectRatio: "448 / 84",
    paddingInline: "10px",
    boxSizing: "border-box",
    borderRadius: "8px",
    position: "relative",
    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
    "& > span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&[data-large]": {
      paddingInline: "12px",
      fontSize: "14px",
    },
  },
});

const TileText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    paddingInline: "2px",
    "& strong": { fontSize: "15px", color: "var(--z-fg-primary)" },
    "& span": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const WearButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "36px",
    marginTop: "auto",
    borderRadius: "var(--z-shape-button, 6px)",
    border: "none",
    background: "var(--z-designs-pink-gradient)",
    color: "#fff",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _disabled: { cursor: "default" },
    "&[data-wearing]": {
      background:
        "color-mix(in srgb, var(--z-presence-online, #55DCC8) 16%, transparent)",
      color: "var(--z-presence-online, #55DCC8)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const SmallGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "12px",
  },
});

const PartTile = styled("button", {
  base: {
    ...tileSurface,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "16px 10px 12px",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "border-color 120ms ease, transform 150ms ease",
    _hover: {
      borderColor: "color-mix(in srgb, #FF5BA8 45%, var(--z-border-strong))",
      transform: "translateY(-1px)",
    },
    "&[aria-pressed='true']": { borderColor: PINK },
    _disabled: { cursor: "progress" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _motionReduce: { transition: "none", _hover: { transform: "none" } },
  },
});

const PartStage = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "100px",
    height: "100px",
  },
});

const PlateGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
  },
});

const PlateTile = styled("button", {
  base: {
    ...tileSurface,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "10px",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "border-color 120ms ease",
    _hover: {
      borderColor: "color-mix(in srgb, #FF5BA8 45%, var(--z-border-strong))",
    },
    "&[aria-pressed='true']": { borderColor: PINK },
    _disabled: { cursor: "progress" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const PlateLabel = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: "2px",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Worn = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "22px",
    paddingInline: "8px",
    borderRadius: "var(--z-shape-pill, 9999px)",
    fontSize: "12px",
    fontWeight: 700,
    color: "#fff",
    background: "var(--z-designs-fill)",
    "--z-icon-color": "currentColor",
  },
});

const Notice = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "var(--z-shape-card, 14px)",
    fontSize: "13px",
    color: "var(--z-presence-online, #55DCC8)",
    background:
      "color-mix(in srgb, var(--z-presence-online, #55DCC8) 10%, transparent)",
    "--z-icon-color": "currentColor",
    "& > span": { flex: 1 },
    "& button": {
      border: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline",
    },
    "&[data-error]": {
      color: "var(--z-danger)",
      background: "color-mix(in srgb, var(--z-danger) 10%, transparent)",
    },
  },
});
