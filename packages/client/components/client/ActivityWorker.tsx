import { createSignal } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

import { lazy } from "@revolt/common/lib/lazyPart";

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

/** The desktop app's bridge, downloaded only there (a browser has none) */
const ActivityBridge = lazy(() => import("./ActivityBridge"));

/**
 * Hands what the desktop app sees to the server: programs running and apps
 * over its local RPC (`ActivityBridge`). Nothing in a browser.
 */
export function ActivityWorker() {
  if (!desktopActivity()) return null;
  return <ActivityBridge />;
}
