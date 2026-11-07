import { useLingui } from "@lingui/solid/macro";

/**
 * The words at the top of Home, by the time of day
 * @param who Who to greet
 */
export function useGreeting(who: () => string) {
  const { t } = useLingui();

  return () => {
    const hour = new Date().getHours();
    // this variable's name is part of the message id in the catalogs
    const name = who();
    return hour < 5
      ? t`Up late, ${name}?`
      : hour < 12
        ? t`Good morning, ${name}`
        : hour < 18
          ? t`Good afternoon, ${name}`
          : t`Good evening, ${name}`;
  };
}
