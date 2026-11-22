import { createEffect, createSignal, on, onCleanup } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

import { useModals } from "@revolt/modal";

import { useClient } from ".";
import { createActivitySender } from "./activitySender";

/** The desktop app's rich presence bridge (`window.native.activity`) */
export type DesktopActivity = {
  state(): Promise<DesktopActivityState>;
  current(): Promise<DesktopActivityUpdate>;
  setSharing(on: boolean): Promise<DesktopActivityState>;
  setDetection(on: boolean): Promise<DesktopActivityState>;
  setEntry(
    id: string,
    change: { name?: string; off?: boolean },
  ): Promise<DesktopActivityState>;
  running(): Promise<{ pid: number; name: string; path?: string }[]>;
  add(pid: number, name: string, kind: string): Promise<DesktopActivityState>;
  removeAdded(id: string): Promise<DesktopActivityState>;
  blockApp(id: string, blocked: boolean): Promise<DesktopActivityState>;
  /** A new app asked to show what you do: Show (true) or Block (false) */
  decideApp(id: string, show: boolean): Promise<DesktopActivityState>;
  /** The person clicked the desktop notice about a new app */
  onAsk(callback: (id: string) => void): () => void;
  forgetApp(id: string): Promise<DesktopActivityState>;
  setCompat(on: boolean): Promise<DesktopActivityState>;
  startPairing(): Promise<DesktopActivityState>;
  stopPairing(): Promise<DesktopActivityState>;
  onUpdate(callback: (update: DesktopActivityUpdate) => void): () => void;
  onState(callback: (state: DesktopActivityState) => void): () => void;
};

type DataActivity = Parameters<Client["setActivity"]>[1];

export type DesktopActivityUpdate = {
  rpc: DataActivity;
  desktop: DataActivity;
  rpcApp?: string;
};

export type DesktopActivityEntry = {
  id: string;
  name: string;
  originalName: string;
  category: "game" | "app";
  kind: string;
  off: boolean;
  added: boolean;
  running: boolean;
};

export type DesktopActivityState = {
  sharing: boolean;
  detection: boolean;
  discordCompat: boolean;
  platform: "win" | "mac" | "linux";
  entries: DesktopActivityEntry[];
  apps: {
    id: string;
    name: string;
    blocked: boolean;
    active: boolean;
    /** false: held until the person picks Show or Block */
    decided?: boolean;
    /** Where the program that connected lives, when it is one of yours */
    path?: string;
  }[];
  extension: { port?: number; paired: number; pairingCode?: string };
  pipes: number;
  /** The common-name pipe is open now (closed while the other app runs) */
  compatOpen?: boolean;
};

/** The bridge, on the desktop app only */
export function desktopActivity(): DesktopActivity | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { native?: { activity?: DesktopActivity } })
    .native?.activity;
}

/** Whether the server has rich presence on */
export function richPresenceEnabled(client: Client | undefined): boolean {
  const features = client?.configuration?.features as
    | { rich_presence?: boolean }
    | undefined;
  return !!features?.rich_presence;
}

/**
 * Whether the person shares their activity, as this app last heard (the
 * Activity settings page sets it when it changes)
 */
const [sharing, setSharing] = createSignal<boolean | undefined>(undefined);
export { sharing as activitySharing, setSharing as setActivitySharing };

/**
 * Hands what the desktop app sees to the server: programs running and
 * apps over its local RPC. Runs only in the desktop app, only while the
 * server has the feature on and the person shares their activity. The
 * browser has nothing to report.
 */
export function ActivityWorker() {
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
