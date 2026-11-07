import { For, JSX, Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import type { CollectibleRef } from "@revolt/state/stores/Collectibles";
import { Avatar, Dialog, UserStatus } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import {
  NameplateMotion,
  useDesignMotion,
} from "@revolt/ui/components/features/profiles/NameplateMotion";
import {
  NAME_GRADIENTS,
  NAME_SOLIDS,
} from "@revolt/ui/components/features/profiles/nameStyles";
import { useCountryNames } from "@revolt/ui/components/features/profiles/plateNames";
import {
  type NameplateGroup,
  DECORATIONS,
  NAMEPLATES,
  NAME_FONTS,
  THEME_PRESETS,
  UserStyle,
  isCommunityRef,
  nameStyle,
  nameplateBackground,
  themeColours,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { useInstance } from "@revolt/instance";

/** Translated names for decorations and theme presets */
export function useStyleLabels() {
  const { t } = useLingui();
  const decorations: Record<string, string> = {
    laurel: t`Laurel`,
    "light-crown": t`Crown of light`,
    rings: t`Rings`,
    ivy: t`Ivy`,
    "thorn-roses": t`Thorn roses`,
    "ice-crystal": t`Ice crystal`,
    "flame-ring": t`Flame ring`,
    lightning: t`Lightning`,
    "moon-halo": t`Moon halo`,
    "sun-rays": t`Sun rays`,
    "star-orbit": t`Stars in orbit`,
    "sakura-branch": t`Cherry branch`,
    "geometric-hex": t`Hexagon`,
    neon: t`Neon`,
    wings: t`Wing frame`,
    feathers: t`Feathers`,
    gear: t`Gears`,
    circuit: t`Circuit`,
    waves: t`Waves`,
    leaves: t`Autumn wreath`,
    snow: t`Snow`,
    hearts: t`Hearts`,
    "music-notes": t`Music notes`,
    "shield-frame": t`Shield`,
  };
  const themes: Record<string, string> = {
    Sunset: t`Sunset`,
    Ocean: t`Ocean`,
    Grape: t`Grape`,
    Mint: t`Mint`,
    Midnight: t`Midnight`,
    Cherry: t`Cherry`,
    Gold: t`Gold`,
    Aurora: t`Aurora`,
    Rose: t`Rose`,
    Forest: t`Forest`,
    Neon: t`Neon`,
    Candy: t`Candy`,
  };
  const nameplates: Record<string, string> = {
    aurora: t`Aurora`,
    autumn: t`Autumn`,
    sakura: t`Cherry blossoms`,
    ocean: t`Ocean`,
    clouds: t`Clouds`,
    sunset: t`Sunset`,
    midnight: t`Midnight`,
    mint: t`Mint`,
    "zodiac-aries": t`Aries`,
    "zodiac-taurus": t`Taurus`,
    "zodiac-gemini": t`Gemini`,
    "zodiac-cancer": t`Cancer`,
    "zodiac-leo": t`Leo`,
    "zodiac-virgo": t`Virgo`,
    "zodiac-libra": t`Libra`,
    "zodiac-scorpio": t`Scorpio`,
    "zodiac-sagittarius": t`Sagittarius`,
    "zodiac-capricorn": t`Capricorn`,
    "zodiac-aquarius": t`Aquarius`,
    "zodiac-pisces": t`Pisces`,
    ...useCountryNames(),
  };
  return {
    decoration: (id?: string) => (id ? (decorations[id] ?? id) : t`None`),
    theme: (id: string) => themes[id] ?? id,
    nameplate: (id?: string) =>
      id?.startsWith("c:")
        ? t`Community nameplate`
        : id
          ? (nameplates[id] ?? id)
          : t`None`,
  };
}

/** Names of the display-name fonts */
export function useNameFontLabel() {
  const { t } = useLingui();
  return (id: string) =>
    ({
      default: t`Default`,
      bold: t`Bold`,
      serif: t`Serif`,
      mono: t`Mono`,
      script: t`Script`,
      pixel: t`Pixel`,
      wide: t`Wide`,
      rounded: t`Rounded`,
      geo: t`Geometric`,
      modern: t`Modern`,
      elegant: t`Elegant`,
      strong: t`Strong`,
      clear: t`Clear`,
      soft: t`Soft`,
      slab: t`Slab`,
      classic: t`Classic`,
      comic: t`Comic`,
      typewriter: t`Typewriter`,
      code: t`Code`,
      kufi: t`Arabic sans`,
    })[id] ?? id;
}

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
        <Swatch title={t`Main colour`}>
          <input
            type="color"
            aria-label={t`Main colour`}
            value={first()}
            onInput={(e) =>
              props.onChange([
                e.currentTarget.value,
                ...(second() ? [second()!] : []),
              ])
            }
          />
        </Swatch>
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
          <Swatch title={t`Second colour`}>
            <input
              type="color"
              aria-label={t`Second colour`}
              value={second()}
              onInput={(e) => props.onChange([first(), e.currentTarget.value])}
            />
          </Swatch>
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

/**
 * Display name style: font, then no colour / one colour / gradient
 */
export function NameStyleDialog(props: {
  show: boolean;
  onClose: () => void;
  name: string;
  /** @username shown under the name in the preview */
  handle?: string;
  avatar?: string;
  value: UserStyle;
  onApply: (style: Pick<UserStyle, "name_font" | "name_colour">) => void;
}) {
  const { t, i18n } = useLingui();
  const fontLabel = useNameFontLabel();
  // the dialog edits a copy; it opens fresh each time
  /* eslint-disable solid/reactivity */
  const [font, setFont] = createSignal(props.value.name_font ?? "default");
  const [colour, setColour] = createSignal<string[]>(
    props.value.name_colour ?? [],
  );
  /* eslint-enable solid/reactivity */
  const mode = () =>
    colour().length === 2
      ? "gradient"
      : colour().length === 1
        ? "solid"
        : "none";
  const draft = (): UserStyle => ({ name_font: font(), name_colour: colour() });
  const changed = () =>
    font() !== (props.value.name_font ?? "default") ||
    !sameColours(colour(), props.value.name_colour);

  function surprise() {
    const pick = <T,>(list: readonly T[]) =>
      list[Math.floor(Math.random() * list.length)];
    setFont(pick(NAME_FONTS).id);
    setColour(
      Math.random() < 0.5 ? [pick(NAME_SOLIDS)] : [...pick(NAME_GRADIENTS)],
    );
  }

  return (
    <Dialog
      tone="edit"
      iconName="at"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Display name style</Trans>}
      description={<Trans>Pick a font and colour for your display name.</Trans>}
      size="xl"
      actions={[
        {
          text: <Trans>Reset</Trans>,
          variant: "text",
          onClick: () => {
            setFont("default");
            setColour([]);
            return false;
          },
        },
        {
          text: <Trans>Apply</Trans>,
          isDisabled: !changed(),
          onClick: () =>
            props.onApply({
              name_font: font() === "default" ? undefined : font(),
              name_colour: colour(),
            }),
        },
      ]}
    >
      <Split>
        <div>
          <Label>
            <Trans>Choose font</Trans>
          </Label>
          <FontGrid>
            <For each={NAME_FONTS}>
              {(option) => (
                <Choice
                  type="button"
                  aria-pressed={font() === option.id}
                  onClick={() => setFont(option.id)}
                  style={nameStyle({ name_font: option.id })}
                  title={fontLabel(option.id)}
                  aria-label={fontLabel(option.id)}
                >
                  {i18n().locale === "ar" ? "زر" : "Gg"}
                </Choice>
              )}
            </For>
          </FontGrid>

          <Label>
            <Trans>Choose colour</Trans>
          </Label>
          <Modes>
            <Mode
              type="button"
              aria-pressed={mode() === "none"}
              onClick={() => setColour([])}
            >
              <Trans>None</Trans>
            </Mode>
            <Mode
              type="button"
              aria-pressed={mode() === "solid"}
              onClick={() => setColour([colour()[0] ?? NAME_SOLIDS[0]])}
            >
              <Trans>Solid</Trans>
            </Mode>
            <Mode
              type="button"
              aria-pressed={mode() === "gradient"}
              onClick={() =>
                setColour(
                  colour().length === 2 ? colour() : [...NAME_GRADIENTS[0]],
                )
              }
            >
              <Trans>Gradient</Trans>
            </Mode>
          </Modes>

          <Show when={mode() !== "none"}>
            <ColourRow>
              <Swatch data-large title={t`Pick a colour`}>
                <input
                  type="color"
                  aria-label={t`Pick a colour`}
                  value={colour()[0]}
                  onInput={(e) =>
                    setColour([e.currentTarget.value, ...colour().slice(1)])
                  }
                />
              </Swatch>
              <Show when={mode() === "gradient"}>
                <Swatch data-large title={t`Second colour`}>
                  <input
                    type="color"
                    aria-label={t`Second colour`}
                    value={colour()[1]}
                    onInput={(e) =>
                      setColour([colour()[0], e.currentTarget.value])
                    }
                  />
                </Swatch>
              </Show>
              <SmallSwatches>
                <For
                  each={
                    mode() === "solid"
                      ? NAME_SOLIDS.map((c) => [c])
                      : NAME_GRADIENTS.map((g) => [...g])
                  }
                >
                  {(option) => (
                    <SmallSwatch
                      type="button"
                      aria-label={option.join(" → ")}
                      aria-pressed={sameColours(colour(), option)}
                      style={{
                        background:
                          option.length === 2
                            ? `linear-gradient(90deg, ${option[0]}, ${option[1]})`
                            : option[0],
                      }}
                      onClick={() => setColour(option)}
                    />
                  )}
                </For>
              </SmallSwatches>
            </ColourRow>
          </Show>

          <Surprise type="button" onClick={surprise}>
            <Icon name="sparkle" size={16} />
            <Trans>Surprise me</Trans>
          </Surprise>
        </div>

        <PreviewStack>
          <MiniProfile>
            <MiniBanner />
            <MiniAvatar>
              <Avatar size={72} src={props.avatar} fallback={props.name} />
            </MiniAvatar>
            <strong style={nameStyle(draft())}>
              <bdi>{props.name}</bdi>
            </strong>
            <Show when={props.handle}>
              <small>
                <bdi>@{props.handle}</bdi>
              </small>
            </Show>
          </MiniProfile>
          <PreviewMessage>
            <Avatar size={36} src={props.avatar} fallback={props.name} />
            <div>
              <span class={"head"}>
                <strong style={nameStyle(draft())}>
                  <bdi>{props.name}</bdi>
                </strong>
                <time>
                  <Trans>now</Trans>
                </time>
              </span>
              <span>
                <Trans>does anyone read this?</Trans>
              </span>
            </div>
          </PreviewMessage>
          <MemberRow>
            <Avatar size={24} src={props.avatar} fallback={props.name} />
            <strong style={nameStyle(draft())}>
              <bdi>{props.name}</bdi>
            </strong>
          </MemberRow>
          <Note>
            <Trans>
              In a server, a role colour wins over yours, but your font stays.
              On a profile card with a theme, your name turns white so it stays
              readable.
            </Trans>
          </Note>
        </PreviewStack>
      </Split>
    </Dialog>
  );
}

/** Included decorations grouped for the gallery's category filter */
const DECORATION_CATEGORIES: Record<string, string[]> = {
  rings: ["glow", "gold", "neon", "galaxy", "sparkle", "heartbeat"],
  elements: ["flames", "fire", "ice", "lightning", "snow", "toxic"],
  fun: ["hearts", "stars", "headphones", "laurel"],
};

/**
 * Avatar decoration library: categories, search, favourites and recently
 * worn items, with a live preview on the user's own card, message and
 * member row.
 */
export function DecorationDialog(props: {
  show: boolean;
  onClose: () => void;
  name: string;
  /** @username shown under the name in the preview */
  handle?: string;
  avatar?: string;
  /** the rest of the user's look, so the preview matches what others see */
  style?: UserStyle;
  value?: string;
  /** image of the current community decoration */
  file?: string;
  onApply: (decoration: string | undefined, file?: string) => void;
}) {
  const { t } = useLingui();
  const labels = useStyleLabels();
  const state = useState();
  const instance = useInstance();
  /* eslint-disable solid/reactivity */
  const [choice, setChoice] = createSignal(props.value);
  const [file, setFile] = createSignal(props.file);
  /* eslint-enable solid/reactivity */
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal<string>("all");

  const pick = (id: string | undefined, image?: string) => {
    setChoice(id);
    setFile(image);
  };

  const categories = (): {
    id: string;
    label: string;
    icon?: "heart" | "clock-counter-clockwise";
  }[] => [
    { id: "all", label: t`All` },
    { id: "favourites", label: t`Favourites`, icon: "heart" },
    { id: "recent", label: t`Recent`, icon: "clock-counter-clockwise" },
    { id: "rings", label: t`Rings` },
    { id: "elements", label: t`Elements` },
    { id: "fun", label: t`Fun` },
  ];

  const matches = (label: string) =>
    label.toLocaleLowerCase().includes(search().trim().toLocaleLowerCase());

  const included = () =>
    DECORATIONS.filter(
      (id) =>
        (category() === "all" ||
          DECORATION_CATEGORIES[category()]?.includes(id)) &&
        matches(labels.decoration(id)),
    );

  const refLabel = (ref: CollectibleRef) =>
    isCommunityRef(ref.id)
      ? t`Community decoration`
      : labels.decoration(ref.id);

  const saved = (list: CollectibleRef[]) =>
    list.filter(
      (ref) =>
        (isCommunityRef(ref.id) ||
          (DECORATIONS as readonly string[]).includes(ref.id)) &&
        matches(refLabel(ref)),
    );

  const favourites = () => saved(state.collectibles.favourites("decorations"));
  const recent = () => saved(state.collectibles.recent("decorations"));

  /** the user's look with the decoration being tried on */
  const draft = (): UserStyle => ({
    ...props.style,
    decoration: choice(),
    decoration_file: file(),
  });
  const theme = () => themeColours(props.style);
  const motion = useDesignMotion();
  const plate = () =>
    nameplateBackground(props.style, instance.mediaUrl, { moving: motion() });

  /** one decoration tile: tap to try it on, heart to save it */
  const Tile = (tile: { id: string; file?: string; label: string }) => (
    <DecoTile
      type="button"
      aria-pressed={choice() === tile.id}
      onClick={() => pick(tile.id, tile.file)}
    >
      <AvatarDecoration decoration={tile.id} file={tile.file} size={48}>
        <Avatar size={48} src={props.avatar} fallback={props.name} />
      </AvatarDecoration>
      <span title={tile.label}>{tile.label}</span>
      <FavouriteButton
        active={state.collectibles.isFavourite("decorations", tile.id)}
        onToggle={() =>
          state.collectibles.toggleFavourite("decorations", {
            id: tile.id,
            file: tile.file,
          })
        }
      />
      <Show when={choice() === tile.id}>
        <CheckBadge>
          <Icon name="check" size={12} />
        </CheckBadge>
      </Show>
    </DecoTile>
  );

  const SearchBox = () => (
    <GallerySearch>
      <Icon name="magnifying-glass" size={16} />
      <input
        type="search"
        placeholder={t`Search decorations`}
        aria-label={t`Search decorations`}
        value={search()}
        onInput={(e) => setSearch(e.currentTarget.value)}
      />
    </GallerySearch>
  );

  return (
    <Dialog
      tone="edit"
      iconName="smiley"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Change avatar decoration</Trans>}
      description={
        <Trans>A frame around your avatar. All of them are free.</Trans>
      }
      size="xl"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Apply</Trans>,
          isDisabled: choice() === props.value,
          onClick: () => {
            const id = choice();
            if (id)
              state.collectibles.markUsed("decorations", { id, file: file() });
            props.onApply(id, file());
          },
        },
      ]}
    >
      <Split>
        <div>
          <GalleryToolbar>
            <SearchBox />
            <Chips role="group" aria-label={t`Categories`}>
              <For each={categories()}>
                {(entry) => (
                  <Chip
                    type="button"
                    aria-pressed={category() === entry.id}
                    onClick={() => setCategory(entry.id)}
                  >
                    <Show when={entry.icon}>
                      <Icon name={entry.icon!} size={13} />
                    </Show>
                    {entry.label}
                    <Show
                      when={
                        entry.id === "favourites" &&
                        state.collectibles.favourites("decorations").length
                      }
                    >
                      <TabCount>
                        {state.collectibles.favourites("decorations").length}
                      </TabCount>
                    </Show>
                  </Chip>
                )}
              </For>
            </Chips>
          </GalleryToolbar>
          <Switch>
            <Match
              when={category() === "favourites" || category() === "recent"}
            >
              <DecoGrid>
                <For
                  each={category() === "favourites" ? favourites() : recent()}
                  fallback={
                    <GalleryEmpty>
                      <Show
                        when={search().trim()}
                        fallback={
                          <Show
                            when={category() === "favourites"}
                            fallback={
                              <Trans>
                                Decorations you wear will show up here.
                              </Trans>
                            }
                          >
                            <Trans>
                              Tap the heart on a decoration to save it here.
                            </Trans>
                          </Show>
                        }
                      >
                        <Trans>No decorations match your search.</Trans>
                      </Show>
                    </GalleryEmpty>
                  }
                >
                  {(ref) => (
                    <Tile id={ref.id} file={ref.file} label={refLabel(ref)} />
                  )}
                </For>
              </DecoGrid>
            </Match>
            <Match when={true}>
              <DecoGrid>
                <Show when={category() === "all" && !search().trim()}>
                  <DecoTile
                    type="button"
                    aria-pressed={!choice()}
                    onClick={() => pick(undefined)}
                  >
                    <Avatar
                      size={48}
                      src={props.avatar}
                      fallback={props.name}
                    />
                    <span>{labels.decoration(undefined)}</span>
                    <Show when={!choice()}>
                      <CheckBadge>
                        <Icon name="check" size={12} />
                      </CheckBadge>
                    </Show>
                  </DecoTile>
                </Show>
                <For
                  each={included()}
                  fallback={
                    <GalleryEmpty>
                      <Trans>No decorations match your search.</Trans>
                    </GalleryEmpty>
                  }
                >
                  {(id) => <Tile id={id} label={labels.decoration(id)} />}
                </For>
              </DecoGrid>
            </Match>
          </Switch>
        </div>

        <PreviewStack>
          <PreviewCard
            style={
              theme()
                ? {
                    background: `linear-gradient(180deg, ${theme()!.top}, ${theme()!.bottom})`,
                    "--avatar-status-ring": theme()!.top,
                  }
                : undefined
            }
            data-themed={!!theme()}
          >
            <PreviewCardBanner />
            <PreviewCardAvatar>
              <AvatarDecoration
                decoration={choice()}
                file={file()}
                size={84}
                live
              >
                <Avatar
                  size={84}
                  src={props.avatar}
                  fallback={props.name}
                  holepunch="bottom-right"
                  overlay={<UserStatus.Graphic status="Online" />}
                />
              </AvatarDecoration>
            </PreviewCardAvatar>
            <strong
              style={
                theme()
                  ? nameStyle({ name_font: props.style?.name_font })
                  : nameStyle(draft())
              }
            >
              {props.name}
            </strong>
            <Show when={props.handle}>
              <small>
                <bdi>@{props.handle}</bdi>
              </small>
            </Show>
          </PreviewCard>
          <Joined>
            <PreviewMessage data-plain>
              <AvatarDecoration decoration={choice()} file={file()} size={36}>
                <Avatar size={36} src={props.avatar} fallback={props.name} />
              </AvatarDecoration>
              <div>
                <span class="head">
                  <strong style={nameStyle(draft())}>
                    <bdi>{props.name}</bdi>
                  </strong>
                  <time>
                    <Trans>Today at 12:00</Trans>
                  </time>
                </span>
                <span>
                  <Trans>Look at my new decoration</Trans>
                </span>
              </div>
            </PreviewMessage>
            <PreviewMember>
              <PlateRow
                class="z-plate"
                style={plate() ? { "--plate": plate() } : undefined}
              >
                <AvatarDecoration decoration={choice()} file={file()} size={30}>
                  <Avatar
                    size={30}
                    src={props.avatar}
                    fallback={props.name}
                    holepunch="bottom-right"
                    overlay={<UserStatus.Graphic status="Online" />}
                  />
                </AvatarDecoration>
                <strong style={nameStyle(draft())}>
                  <bdi>{props.name}</bdi>
                </strong>
              </PlateRow>
            </PreviewMember>
          </Joined>
          <Current>
            <small>
              <Trans>Selected</Trans>
            </small>
            <strong>
              {choice()?.startsWith("c:")
                ? t`Community decoration`
                : labels.decoration(choice())}
            </strong>
          </Current>
        </PreviewStack>
      </Split>
    </Dialog>
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
 * Nameplate gallery: a background behind your name in member lists
 */
export function NameplateDialog(props: {
  show: boolean;
  onClose: () => void;
  name: string;
  avatar?: string;
  value?: string;
  file?: string;
  onApply: (nameplate: string | undefined, file?: string) => void;
}) {
  const { t, i18n } = useLingui();
  const instance = useInstance();
  const motion = useDesignMotion();
  const labels = useStyleLabels();
  /* eslint-disable solid/reactivity */
  const [choice, setChoice] = createSignal(props.value);
  const [file, setFile] = createSignal(props.file);
  /* eslint-enable solid/reactivity */
  const [search, setSearch] = createSignal("");
  const pick = (id: string | undefined, image?: string) => {
    setChoice(id);
    setFile(image);
  };
  const background = () =>
    nameplateBackground(
      { nameplate: choice(), nameplate_file: file() },
      instance.mediaUrl,
      { moving: motion() },
    );
  const groups = () => {
    const words = search().trim().toLocaleLowerCase(i18n().locale);
    const sorted = (group: NameplateGroup) =>
      NAMEPLATES.filter(
        (plate) =>
          plate.group === group &&
          labels
            .nameplate(plate.id)
            .toLocaleLowerCase(i18n().locale)
            .includes(words),
      ).sort((a, b) =>
        labels
          .nameplate(a.id)
          .localeCompare(labels.nameplate(b.id), i18n().locale),
      );
    return [
      { name: t`Arab countries`, plates: sorted("arab") },
      { name: t`Countries`, plates: sorted("flag") },
      { name: t`Themes`, plates: sorted("theme") },
      { name: t`Zodiac`, plates: sorted("zodiac") },
    ].filter((group) => group.plates.length);
  };

  /** a member-list row with a nameplate behind it */
  const Plate = (plate: {
    id?: string;
    background?: string;
    size?: "small";
    live?: boolean;
  }) => (
    <PlateRow
      class="z-plate"
      data-size={plate.size}
      style={plate.background ? { "--plate": plate.background } : undefined}
    >
      <NameplateMotion plate={plate.id} live={plate.live} />
      <Avatar
        size={plate.size === "small" ? 22 : 30}
        src={props.avatar}
        fallback={props.name}
      />
      <strong>
        <bdi>{props.name}</bdi>
      </strong>
    </PlateRow>
  );

  return (
    <Dialog
      tone="edit"
      iconName="identification-card"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Change nameplate</Trans>}
      description={
        <Trans>
          A background behind your name in member lists. All of them are free.
        </Trans>
      }
      size="xl"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Apply</Trans>,
          isDisabled: choice() === props.value,
          onClick: () => props.onApply(choice(), file()),
        },
      ]}
    >
      <Split>
        <div>
          <PlateSearch
            type="search"
            placeholder={t`Search nameplates`}
            aria-label={t`Search nameplates`}
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <PlateGrid>
            <PlateTile
              type="button"
              aria-pressed={!choice()}
              onClick={() => pick(undefined)}
            >
              <Plate size="small" />
              <span>{t`None`}</span>
              <Show when={!choice()}>
                <CheckBadge>
                  <Icon name="check" size={12} />
                </CheckBadge>
              </Show>
            </PlateTile>
            <For each={groups()}>
              {(group) => (
                <>
                  <PlateHeading>{group.name}</PlateHeading>
                  <For each={group.plates}>
                    {(plate) => (
                      <PlateTile
                        type="button"
                        aria-pressed={choice() === plate.id}
                        onClick={() => pick(plate.id)}
                      >
                        <Plate
                          id={plate.id}
                          size="small"
                          background={nameplateBackground(
                            { nameplate: plate.id },
                            instance.mediaUrl,
                          )}
                        />
                        <span>{labels.nameplate(plate.id)}</span>
                        <Show when={choice() === plate.id}>
                          <CheckBadge>
                            <Icon name="check" size={12} />
                          </CheckBadge>
                        </Show>
                      </PlateTile>
                    )}
                  </For>
                </>
              )}
            </For>
          </PlateGrid>
        </div>

        <PreviewStack>
          <PreviewProfile>
            <Plate id={choice()} background={background()} live />
          </PreviewProfile>
          <Note>
            <Trans>
              Your nameplate shows behind your name in member lists.
            </Trans>
          </Note>
        </PreviewStack>
      </Split>
    </Dialog>
  );
}

const PlateRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    aspectRatio: "448 / 84",
    paddingInline: "10px",
    boxSizing: "border-box",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-sidebar, var(--z-bg-input))",
    color: "#fff",
    position: "relative",
    "& strong": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      fontSize: "14px",
      fontWeight: 650,
      textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
    },
    "&[data-size='small']": {
      gap: "6px",
      paddingInline: "6px",
      "& strong": { fontSize: "12px" },
    },
  },
});

const PlateGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "10px",
    maxHeight: "min(420px, 55dvh)",
    overflowY: "auto",
    padding: "4px",
  },
});

const PlateSearch = styled("input", {
  base: {
    width: "100%",
    height: "36px",
    boxSizing: "border-box",
    marginBlockEnd: "12px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-input, 8px)",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    "&:focus-visible": {
      outline: "none",
      boxShadow: "var(--z-field-focus-shadow)",
    },
  },
});

const PlateHeading = styled("div", {
  base: {
    gridColumn: "1 / -1",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    marginBlockStart: "4px",
  },
});

const PlateTile = styled("button", {
  base: {
    // tiles out of view are not drawn, so their flags are not fetched
    contentVisibility: "auto",
    containIntrinsicSize: "auto 92px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    border: "1px solid var(--z-btn-surface-border)",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",
    _hover: { borderColor: "var(--z-border-strong)" },
    "&[aria-pressed='true']": {
      borderColor: "var(--z-accent)",
      boxShadow: "inset 0 0 0 1px var(--z-accent)",
    },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});
/** A row in the Look section that opens one of the dialogs */
export function LookRow(props: {
  icon: JSX.Element;
  title: JSX.Element;
  value: JSX.Element;
  onClick: () => void;
}) {
  return (
    <Row type="button" onClick={() => props.onClick()}>
      <RowIcon>{props.icon}</RowIcon>
      <span data-text>
        <strong>{props.title}</strong>
        <small>{props.value}</small>
      </span>
      <Icon name="caret-right" size={16} />
    </Row>
  );
}

const ThemeWrap = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const CustomRow = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "10px" },
});

const Swatch = styled("label", {
  base: {
    position: "relative",
    width: "40px",
    height: "40px",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    border: "1px solid var(--z-border-strong)",
    cursor: "pointer",
    flexShrink: 0,
    "&[data-large]": { width: "84px", height: "56px" },
    "& input": {
      position: "absolute",
      inset: "-8px",
      width: "calc(100% + 16px)",
      height: "calc(100% + 16px)",
      border: "none",
      padding: 0,
      cursor: "pointer",
    },
  },
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

const Split = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: "20px",
    alignItems: "start",
    "@media (max-width: 720px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Label = styled("div", {
  base: {
    margin: "4px 0 8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const FontGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "16px",
  },
});

const choice = {
  border: "1px solid var(--z-border-subtle)",
  borderRadius: "var(--z-radius, 10px)",
  background: "var(--z-bg-input)",
  color: "var(--z-fg-primary)",
  cursor: "pointer",
  transition: "border-color 0.12s ease",
  _hover: { borderColor: "var(--z-border-strong)" },
  "&[aria-pressed='true']": {
    borderColor: "var(--z-accent)",
    boxShadow: "inset 0 0 0 1px var(--z-accent)",
    background: "color-mix(in srgb, var(--z-accent) 10%, var(--z-bg-input))",
  },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
} as const;

const Choice = styled("button", {
  base: { ...choice, height: "52px", fontSize: "20px" },
});

const Modes = styled("div", {
  base: { display: "flex", gap: "8px", marginBottom: "12px" },
});

const Mode = styled("button", {
  base: {
    ...choice,
    height: "38px",
    paddingInline: "14px",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
  },
});

const ColourRow = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "12px" },
});

const SmallSwatches = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 34px)",
    gap: "6px",
  },
});

const SmallSwatch = styled("button", {
  base: {
    width: "34px",
    height: "24px",
    border: "2px solid transparent",
    borderRadius: "7px",
    cursor: "pointer",
    "&[aria-pressed='true']": { borderColor: "#fff" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Surprise = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "16px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { color: "var(--z-fg-primary)" },
  },
});

const PreviewStack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px" },
});

const PreviewProfile = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "20px 12px",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    "& strong": { fontSize: "18px", fontWeight: 700 },
    "&[data-big]": { padding: "28px 12px" },
  },
});

const PreviewMessage = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    "& > div": { display: "flex", flexDirection: "column", minWidth: 0 },
    "& strong": { fontSize: "14px", fontWeight: 700 },
    "& span": { fontSize: "14px", color: "var(--z-fg-primary)" },
    "& .head": {
      display: "flex",
      alignItems: "baseline",
      gap: "6px",
      minWidth: 0,
    },
    "& .head strong": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& .head time": { flexShrink: 0 },
    "& time": { fontSize: "12px", color: "var(--z-fg-muted)" },
    "&[data-plain]": { border: "none", borderRadius: 0, background: "none" },
  },
});

/** Small profile card: banner, avatar overlapping it, name and handle */
const MiniProfile = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    paddingBottom: "16px",
    overflow: "hidden",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    "& strong": { marginTop: "8px", fontSize: "20px", fontWeight: 700 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const MiniBanner = styled("div", {
  base: {
    alignSelf: "stretch",
    height: "62px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--z-accent) 40%, var(--z-bg-raised)), var(--z-bg-raised))",
  },
});

const MiniAvatar = styled("div", {
  base: {
    marginTop: "-40px",
    padding: "4px",
    borderRadius: "50%",
    background: "var(--z-bg-input)",
    lineHeight: 0,
  },
});

/** A member-list row */
const MemberRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "&[data-plain]": {
      border: "none",
      borderTop: "1px solid var(--z-border-subtle)",
      borderRadius: 0,
      background: "none",
    },
  },
});

/** Message + member row stacked in one card */
const Joined = styled("div", {
  base: {
    overflow: "hidden",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
  },
});

const Note = styled("p", {
  base: {
    margin: "2px 2px 0",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

/** Round check on the chosen tile */
const CheckBadge = styled("span", {
  base: {
    position: "absolute",
    top: "6px",
    insetInlineEnd: "6px",
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "var(--z-accent-fill, var(--z-accent))",
    color: "var(--z-on-accent, #fff)",
    "--z-icon-color": "currentColor",
  },
});

const Current = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& small": {
      fontSize: "11px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
    },
    "& strong": { fontSize: "14px" },
  },
});

const DecoGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
    alignContent: "start",
    gap: "10px",
    // same height on every tab, so the dialog doesn't jump around
    height: "min(360px, 50dvh)",
    overflowY: "auto",
    padding: "4px",
  },
});

const DecoTile = styled("button", {
  base: {
    ...choice,
    position: "relative",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    height: "112px",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    overflow: "hidden",
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
    "& + &": { borderTop: "1px solid var(--z-border-subtle)" },
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
    "&:dir(rtl) > svg:last-child": { transform: "scaleX(-1)" },
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

const TabCount = styled("span", {
  base: {
    minWidth: "18px",
    height: "18px",
    paddingInline: "5px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    fontSize: "11px",
    lineHeight: "18px",
    textAlign: "center",
  },
});

const GalleryToolbar = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "10px",
  },
});

const GallerySearch = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "38px",
    paddingInline: "12px",
    borderRadius: "999px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
    },
  },
});

const Chips = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "6px" },
});

const Chip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    "--z-icon-color": "currentColor",
    height: "30px",
    paddingInline: "12px",
    borderRadius: "999px",
    border: "1px solid var(--z-btn-surface-border)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
    _hover: {
      color: "var(--z-fg-primary)",
      borderColor: "var(--z-border-strong)",
    },
    "&[aria-pressed='true']": {
      background: "var(--z-accent-fill, var(--z-accent))",
      borderColor: "var(--z-accent)",
      color: "var(--z-on-accent, #fff)",
    },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const GalleryEmpty = styled("p", {
  base: {
    gridColumn: "1 / -1",
    margin: 0,
    padding: "32px 8px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
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
    _focusVisible: { opacity: 1, outline: "2px solid var(--z-focus)" },
    _hover: { transform: "scale(1.08)" },
    "&[data-active='true']": { opacity: 1, color: "var(--z-accent-text)" },
  },
});

/** Small profile card in the decoration preview */
const PreviewCard = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    padding: "0 16px 16px",
    overflow: "hidden",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    "--avatar-status-ring": "var(--z-bg-input)",
    "& strong": { marginTop: "8px", fontSize: "20px", fontWeight: 700 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    "&[data-themed='true'] strong": { color: "#fff" },
    "&[data-themed='true'] small": { color: "rgb(255 255 255 / 75%)" },
  },
});

const PreviewCardBanner = styled("div", {
  base: {
    alignSelf: "stretch",
    height: "64px",
    marginInline: "-16px",
    background: "rgb(255 255 255 / 6%)",
  },
});

const PreviewCardAvatar = styled("div", {
  base: {
    marginTop: "-46px",
    lineHeight: 0,
  },
});

const PreviewMember = styled("div", {
  base: {
    padding: "6px",
    borderTop: "1px solid var(--z-border-subtle)",
    "--avatar-status-ring": "var(--z-bg-input)",
  },
});
