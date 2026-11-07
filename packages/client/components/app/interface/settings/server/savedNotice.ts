import { useLingui } from "@lingui/solid/macro";

import { useSnackbar } from "@revolt/ui";

/**
 * "Saved" confirmation for a setting that is applied on its own (a switch or
 * a choice that does not wait for the page's save bar). Call the returned
 * function after the change went through; on an error show the error
 * instead, the control keeps showing the server's value so nothing needs
 * to be undone by hand.
 */
export function useSaved() {
  const { t } = useLingui();
  const snackbar = useSnackbar();
  return () => snackbar.show({ message: t`Saved`, replaceActive: true });
}
