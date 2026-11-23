import { createEffect, on, onCleanup } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

import { useModals } from "@revolt/modal";

import { useClient } from ".";
import {
  type DesktopActivityUpdate,
  desktopActivity,
  richPresenceEnabled,
  setActivitySharing as setSharing,
  activitySharing as sharing,
} from "./ActivityWorker";
import { createActivitySender } from "./activitySender";

type DataActivity = Parameters<Client["setActivity"]>[1];

/**
 * Loaded only in the desktop app (`ActivityWorker`). Hands what the desktop app sees to the server: programs running and
 * apps over its local RPC. Runs only in the desktop app, only while the
 * server has the feature on and the person shares their activity. The
 * browser has nothing to report.
 */
export default function ActivityBridge() {
  const client = useClient();
  const { openModal } = useModals();
  const bridge = desktopActivity();
  if (!bridge) return null;

  const sender = createActivitySender<NonNullable<DataActivity>>({
    send: (source, activity) => client()?.setActivity(source, activity),
  });
  onCleanup(() => sender.stop());

  // what sharing is in force: the server's answer, once per sign-in
  createEffect(
    on(
      () => client(),
      (current) => {
        if (!current || !richPresenceEnabled(current)) return;
        current.users
          .fetchPrivacy()
          .then((privacy) =>
            setSharing(
              (privacy as { share_activity?: boolean }).share_activity === true,
            ),
          )
          .catch(() => setSharing(false));
      },
    ),
  );

  // the desktop scans and listens only while the person shares
  createEffect(
    on(sharing, (on) => {
      if (on === undefined) return;
      void bridge.setSharing(on);
      if (!on) {
        sender.set("Rpc", null);
        sender.set("Desktop", null);
      }
    }),
  );

  const apply = (update: DesktopActivityUpdate) => {
    if (sharing() !== true) return;
    sender.set("Rpc", update.rpc ?? null);
    sender.set("Desktop", update.desktop ?? null);
  };
  const stopUpdates = bridge.onUpdate(apply);
  onCleanup(stopUpdates);

  // a value the server refused is not sent again (the connection stays);
  // your privacy changed elsewhere: the desktop follows at once
  createEffect(
    on(
      () => client(),
      (current) => {
        if (!current) return;
        const refused = (
          source: string,
          error: { type?: string; retry_after?: number },
        ) => {
          if (source !== "Rpc" && source !== "Desktop") return;
          sender.refused(
            source,
            error?.type === "RateLimited"
              ? (error.retry_after ?? 0)
              : undefined,
          );
        };
        const privacy = (value: { share_activity?: boolean | null }) =>
          setSharing(value?.share_activity === true);
        current.on("activityRefused", refused as never);
        current.on("privacyUpdate", privacy as never);
        onCleanup(() => {
          current.removeListener("activityRefused", refused as never);
          current.removeListener("privacyUpdate", privacy as never);
        });
      },
    ),
  );

  // the desktop notice about a new app opens the page where it is decided
  onCleanup(
    bridge.onAsk(() =>
      openModal({
        type: "settings",
        config: "user",
        context: { page: "activity" },
      }),
    ),
  );

  // a new connection forgets this session's activities: send them again
  createEffect(
    on(
      () => client(),
      (current) => {
        if (!current) return;
        const ready = () => {
          sender.reconnected();
          void bridge.current().then(apply);
        };
        current.on("ready", ready);
        onCleanup(() => current.removeListener("ready", ready));
      },
    ),
  );

  return null;
}
