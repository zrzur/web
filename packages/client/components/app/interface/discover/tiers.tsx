import { useLingui } from "@lingui/solid/macro";

/** Internal kinds of the paid Discover boost (ids never change) */
export type TierKind = "Boost" | "SuperBoost" | "MegaBoost" | "TopRow";

/**
 * The one place the display names of the paid Discover tiers live: the
 * Discover pill, the promote dialog and the billing history all read them
 * from here. The paid tier is "Promoted" (never
 * "Featured" while the free "Hand-picked" mark exists); the paid top row is
 * "Top row". "Ad" always stands next to it.
 */
export function useTierName() {
  const { t } = useLingui();
  return (kind: string): string => {
    const names: Record<TierKind, string> = {
      Boost: t`Promoted`,
      SuperBoost: t`Spotlight`,
      MegaBoost: t`Headline`,
      TopRow: t`Top row`,
    };
    // the server may send values this app does not know yet
    return names[kind as TierKind] ?? kind;
  };
}
