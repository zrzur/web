import { createEffect, onCleanup } from "solid-js";

import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";

import { addIOSLaunchImages } from "./headTags";
import { installWay, isIOS } from "./installPrompt";
import { readOffer, recordVisit, shouldOffer } from "./offerRules";

/** Let the first screen settle before a sheet rises over it */
const OFFER_DELAY_MS = 4000;

const storage = (kind: "localStorage" | "sessionStorage") => {
  try {
    return window[kind];
  } catch {
    return undefined;
  }
};

/**
 * Offers to install the app, once, to a signed-in person on a phone: from the
 * second visit, never inside the installed app, and not again for 30 days
 * after the sheet was closed (offerRules.ts). Draws nothing itself.
 */
export function InstallOffer() {
  const device = useDevice();
  const modals = useModals();

  // iOS reads the launch images from the page when the person adds it
  if (isIOS(navigator)) addIOSLaunchImages();

  recordVisit(storage("localStorage"), storage("sessionStorage"));

  let offered = false;
  createEffect(() => {
    // Android tells the page it can be installed a little after it loads
    if (offered || !installWay() || device.layout() !== "phone") return;
    if (!shouldOffer(readOffer(storage("localStorage")), Date.now())) return;

    const timer = setTimeout(() => {
      // not on top of another window, and not if it changed meanwhile
      if (offered || modals.isOpen() || !installWay()) return;
      offered = true;
      modals.openModal({ type: "install_app" });
    }, OFFER_DELAY_MS);
    onCleanup(() => clearTimeout(timer));
  });

  return null;
}
