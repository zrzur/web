import { Trans } from "@lingui/solid/macro";

/**
 * The "are you sure?" text for an under-16 answer. It covers both outcomes: a
 * new account is removed, an older one is limited and reviewed; a limit is
 * not lifted by entering an older age afterwards.
 */
export function UnderMinimumConfirmText() {
  return (
    <Trans>
      Zrzur is only for people aged 16 and older. If you continue, a new account
      is removed. An account that already exists is limited and our team
      reviews it; entering an older age afterwards does not lift the limit. If
      you made a mistake, go back.
    </Trans>
  );
}

/** The sentence after a new account was refused and removed */
export function AgeRefusedText() {
  return (
    <Trans>
      Zrzur is only for people aged 16 and older. We did not keep anything from
      your sign-up.
    </Trans>
  );
}
