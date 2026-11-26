import { useLingui } from "@lingui/solid/macro";

/**
 * The name of a worn effect. Every effect is a creator's (`c:<id>`); a value
 * that is not, such as a built-in effect Zrzur no longer ships, is none.
 */
export function useEffectLabels() {
  const { t } = useLingui();
  return (id: string | undefined) =>
    id?.startsWith("c:") ? t`Community effect` : t`No effect`;
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
    connections: t`Connections`,
    games: t`Games`,
  };
  return (id: string) => labels[id] ?? id;
}
