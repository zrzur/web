import { useLingui } from "@lingui/solid/macro";

/*
 * The names of what you wear, apart from the editors in StyleEditors.tsx:
 * the Designs pages show these names and would otherwise download every
 * editor dialog with them. Decorations, nameplates and frames are all
 * creators' designs (`c:<id>`); a value that is not, such as a built-in
 * design Zrzur no longer ships, is none.
 */

/** Translated names for decorations and theme presets */
export function useStyleLabels() {
  const { t } = useLingui();
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
  const community = (id: string | undefined, name: string) =>
    id?.startsWith("c:") ? name : t`None`;
  return {
    decoration: (id?: string) => community(id, t`Community decoration`),
    theme: (id: string) => themes[id] ?? id,
    /** a profile frame: a creator's frame, or none */
    frame: (id: string | undefined) => community(id, t`Community frame`),
    nameplate: (id?: string) => community(id, t`Community nameplate`),
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
