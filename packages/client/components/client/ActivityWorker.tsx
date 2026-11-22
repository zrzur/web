import { createEffect, createSignal, on, onCleanup } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

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
  running(): Promise<{ pid: number; name: string }[]>;
  add(pid: number, name: string, kind: string): Promise<DesktopActivityState>;
  removeAdded(id: string): Promise<DesktopActivityState>;
  blockApp(id: string, blocked: boolean): Promise<DesktopActivityState>;
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
  apps: { id: string; name: string; blocked: boolean; active: boolean }[];
  extension: { port?: number; paired: number; pairingCode?: string };
  pipes: number;
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
