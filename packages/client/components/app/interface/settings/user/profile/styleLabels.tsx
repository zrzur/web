import { useLingui } from "@lingui/solid/macro";

import { useCountryNames } from "@revolt/ui/components/features/profiles/plateNames";

/*
 * The names of the built-in designs, apart from the editors in
 * StyleEditors.tsx: the Designs pages show these names and would otherwise
 * download every editor dialog with them.
 */

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
