import { useLingui } from "@lingui/solid/macro";
import { withoutNull } from "@zrzur/sdk/solid";
import { onCleanup, onMount } from "solid-js";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useSnackbar } from "@revolt/ui";

/** How often to look again for new requests while the app is open */
const RECHECK_MS = 15 * 60 * 1000;

/**
 * Tells a signed-in user once per request when Zrzur asks them to agree
 * to a profile change, with a button that opens the request. Renders
 * nothing; failures are silent (the request is still in settings).
 */
export function ChangeRequestNotice() {
  const client = useClient();
  const snackbar = useSnackbar();
  const { openModal } = useModals();
  const { t } = useLingui();
  const told = new Set<string>();

  const check = async () => {
    try {
      const requests = await client()
        .api.get("/users/@me/change-requests")
        .then(withoutNull);
      const fresh = requests.filter((r) => !told.has(r._id));
      if (fresh.length === 0) return;
      for (const r of fresh) told.add(r._id);
      snackbar.show({
        message: t`Zrzur asks you to agree to a change to your profile.`,
        action: t`Review`,
        closeable: true,
        messageLine: 2,
        placement: "bottom",
        closeOnAction: true,
        onAction: () =>
          openModal({
            type: "settings",
            config: "user",
            context: { page: "account" },
          }),
      });
    } catch {
      // offline or signed out: settings still shows the request
    }
  };

  onMount(() => {
    void check();
    const timer = setInterval(() => void check(), RECHECK_MS);
    onCleanup(() => clearInterval(timer));
  });

  return null;
}
