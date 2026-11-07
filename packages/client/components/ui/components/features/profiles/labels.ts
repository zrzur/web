import { useLingui } from "@lingui/solid/macro";

/** Names of Zrzur's own effects. Plain words, no film or game names. */
export function useEffectLabels() {
  const { t } = useLingui();
  const labels: Record<string, string> = {
    snow: t`Snow`,
    rain: t`Rain`,
    confetti: t`Confetti`,
    sparks: t`Sparks`,
    petals: t`Petals`,
    bubbles: t`Bubbles`,
    leaves: t`Leaves`,
    fireflies: t`Fireflies`,
    ripples: t`Ripples`,
    kites: t`Kites`,
    aurora: t`Aurora`,
    starfall: t`Falling stars`,
    lanterns: t`Lanterns`,
    sakura: t`Cherry petals`,
    embers: t`Embers`,
    planes: t`Paper planes`,
    butterflies: t`Butterflies`,
    ink: t`Ink drops`,
    shards: t`Crystal shards`,
    comet: t`Comet`,
    "glass-rain": t`Rain on glass`,
    dust: t`Sparkle dust`,
    sunrays: t`Sun rays`,
    moons: t`Moon phases`,
    bloom: t`Geometric bloom`,
    waves: t`Wave lines`,
    burst: t`Confetti burst`,
    feathers: t`Feathers`,
    dandelions: t`Dandelion seeds`,
    hearts: t`Rising hearts`,
  };
  return (id: string | undefined) =>
    id?.startsWith("c:")
      ? t`Community effect`
      : id
        ? (labels[id] ?? id)
        : t`No effect`;
}

/** Names of the profile sections */
export function useSectionLabels() {
  const { t } = useLingui();
  const labels: Record<string, string> = {
    member_since: t`Member since`,
    about: t`About me`,
    links: t`Links`,
    creations: t`Their creations`,
    wearing: t`Wearing`,
  };
  return (id: string) => labels[id] ?? id;
}
