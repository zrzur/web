import { onCleanup, onMount } from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import {
  connectionHints,
  markSaveDataOffered,
  saveData,
  saveDataOffered,
  setSaveData,
  shouldOfferSaveData,
} from "@revolt/common/lib/saveData";
import { useSnackbar } from "@revolt/ui";

/** Let the app settle before speaking: the offer is never the first thing seen */
const OFFER_DELAY_MS = 6000;

/**
 * Offers Save data once, quietly, when the device itself asks for less data
 * (its data saver is on, or the browser rates the line as 2G). A short
 * message at the bottom with one button; closing it or ignoring it is a "no",
 * and it is never shown again on this device. Nothing is switched on unless
 * the person presses the button.
 */
export function SaveDataOffer() {
  const snackbar = useSnackbar();
  const { t } = useLingui();

  onMount(() => {
    const timer = setTimeout(() => {
      if (
        !shouldOfferSaveData({
          on: saveData(),
          offered: saveDataOffered(),
          connection: connectionHints(),
        })
      )
        return;
      markSaveDataOffered();
      snackbar.show({
        message: t`Your device asks to use less data. Turn on Save data?`,
        action: t`Turn on`,
        closeable: true,
        messageLine: 2,
        placement: "bottom",
        closeOnAction: true,
        onAction: () => {
          setSaveData(true);
          snackbar.show({
            message: t`Save data is on. You can change it in Settings.`,
            messageLine: 2,
            placement: "bottom",
          });
        },
      });
    }, OFFER_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  return null;
}
