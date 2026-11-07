/**
 * Reactive plugin state shared by the host and the small hooks elsewhere in
 * the app (notifications, message menu). Kept free of heavy imports so
 * those hooks can import it statically while the host itself loads lazily.
 */
import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";

import {
  type LocalText,
  type Manifest,
  type PanelBlock,
  localise,
} from "../../../plugin-sdk/src/manifest.ts";

import type { PluginHost } from "./host";

/** What the host is doing with one plugin right now */
export type RuntimeStatus =
  /** installed, not running (disabled, Safe Mode or not started yet) */
  | "stopped"
  | "starting"
  | "running"
  /** crashed or misbehaved; see `error` */
  | "failed"
  /** stopped after repeated failures; needs the user to retry */
  | "quarantined"
  /** this platform or app version can't run it */
  | "unsupported"
  /** the server says it may not run (revoked, suspended, consent...) */
  | "blocked";

/** A panel shown by a worker plugin (same block types, handlers instead of commands) */
export type DynamicBlock =
  | Exclude<PanelBlock, { type: "button" } | { type: "setting" }>
  | { type: "button"; label: LocalText; handler: string };

export type OpenPanel =
  | { pluginId: string; kind: "static"; panelId: string }
  | {
      pluginId: string;
      kind: "dynamic";
      title: LocalText;
      blocks: DynamicBlock[];
    };

export type ActivePlugin = {
  id: string;
  manifest: Manifest;
  /** permissions the user granted to this release */
  granted: string[];
  status: RuntimeStatus;
  error?: string;
  /** installed from the store, or a developer's local preview */
  source: "installed" | "preview";
  /** official Zrzur plugin */
  official: boolean;
  settings: Record<string, unknown>;
  /** user toggles of the theme / accessibility contribution */
  themeOn: boolean;
  accessibilityOn: boolean;
  /** handlers a worker registered */
  workerCommands: string[];
  workerMessageActions: string[];
  metrics: {
    activationMs?: number;
    calls: number;
    errors: number;
    lastLatencyMs?: number;
  };
};

export const [plugins, setPlugins] = createStore<Record<string, ActivePlugin>>(
  {},
);

export const [openPanel, setOpenPanel] = createSignal<OpenPanel | null>(null);

/** The running host (null until signed in and booted) */
export const [pluginHost, setPluginHost] = createSignal<PluginHost | null>(
  null,
);

/** Safe Mode: no plugin runs; true when forced by a crash loop as well */
export const [safeMode, setSafeModeSignal] = createSignal(false);

/** Bridges the host installs at start-up (all no-ops until then) */
export const hostHooks: {
  runMessageAction: (
    pluginId: string,
    actionId: string,
    message: PluginMessage,
  ) => void;
  runCommand: (pluginId: string, commandId: string) => void;
  panelButton: (pluginId: string, handler: string) => void;
  setSetting: (pluginId: string, key: string, value: unknown) => void;
} = {
  runMessageAction: () => void 0,
  runCommand: () => void 0,
  panelButton: () => void 0,
  setSetting: () => void 0,
};

/** The only message data a plugin ever receives, and only on user action */
export type PluginMessage = {
  id: string;
  channel_id: string;
  content: string;
  author_name: string;
  created_at: number;
};

export function updatePlugin(
  id: string,
  change: (plugin: ActivePlugin) => void,
) {
  setPlugins(
    produce((all) => {
      if (all[id]) change(all[id]);
    }),
  );
}

export function has(plugin: ActivePlugin, permission: string) {
  return (
    plugin.granted.includes(permission) &&
    (plugin.manifest.permissions as string[]).includes(permission)
  );
}

/** Message actions of running plugins that may see the chosen message */
export function messageActions(locale: string) {
  return Object.values(plugins).flatMap((plugin) =>
    plugin.status === "running" && has(plugin, "context.message.selected")
      ? (plugin.manifest.contributes?.message_actions ?? [])
          .filter((action) =>
            plugin.workerMessageActions.includes(action.handler),
          )
          .map((action) => ({
            pluginId: plugin.id,
            pluginName: localise(
              plugin.manifest.locales?.[locale.split("-")[0]]?.name ??
                plugin.manifest.name,
              locale,
            ),
            actionId: action.id,
            title: localise(action.title, locale),
          }))
      : [],
  );
}

/** Resolve a `$setting:key` binding against a plugin's settings */
/**
 * A plugin's settings as its code should see them: every declared setting
 * with its default, overlaid with what the user saved. Keys the manifest
 * doesn't declare are left out.
 */
export function effectiveSettings(
  plugin: Pick<ActivePlugin, "manifest" | "settings">,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const definition of plugin.manifest.contributes?.settings ?? []) {
    values[definition.key] =
      plugin.settings[definition.key] ?? definition.default;
  }
  return values;
}

export function resolveBinding<T>(
  plugin: ActivePlugin,
  value: unknown,
): T | undefined {
  if (typeof value === "string" && value.startsWith("$setting:")) {
    const key = value.slice("$setting:".length);
    const definition = plugin.manifest.contributes?.settings?.find(
      (s) => s.key === key,
    );
    if (!definition) return undefined;
    return (plugin.settings[key] ?? definition.default) as T;
  }
  return value as T;
}

function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Whether `now` falls in `start`..`end` (wrapping past midnight) */
export function inQuietHours(start: string, end: string, now: Date) {
  const s = minutes(start);
  const e = minutes(end);
  const n = now.getHours() * 60 + now.getMinutes();
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}

export type NotificationPolicy = {
  /** don't show or sound anything */
  suppress: boolean;
  /** show "New message" instead of the content */
  hidePreview: boolean;
  muteSound: boolean;
  /** plugin ids that shaped this decision */
  by: string[];
};

/**
 * How Zrzur should present a notification right now. Plugins never see
 * the notification: they only declared rules, which the host evaluates.
 */
export function notificationPolicy(now = new Date()): NotificationPolicy {
  const policy: NotificationPolicy = {
    suppress: false,
    hidePreview: false,
    muteSound: false,
    by: [],
  };
  if (safeMode()) return policy;
  for (const plugin of Object.values(plugins)) {
    const rules = plugin.manifest.contributes?.notifications;
    if (
      plugin.status !== "running" ||
      !rules ||
      !has(plugin, "notifications.display")
    ) {
      continue;
    }
    let used = false;
    const quietOn =
      rules.quiet_hours_enabled === undefined
        ? true
        : resolveBinding<boolean>(plugin, rules.quiet_hours_enabled) === true;
    if (rules.quiet_hours && quietOn) {
      const start = resolveBinding<string>(plugin, rules.quiet_hours.start);
      const end = resolveBinding<string>(plugin, rules.quiet_hours.end);
      if (
        typeof start === "string" &&
        typeof end === "string" &&
        /^\d\d:\d\d$/.test(start) &&
        /^\d\d:\d\d$/.test(end) &&
        inQuietHours(start, end, now)
      ) {
        policy.suppress = true;
        used = true;
      }
    }
    if (resolveBinding<boolean>(plugin, rules.hide_previews) === true) {
      policy.hidePreview = true;
      used = true;
    }
    if (resolveBinding<boolean>(plugin, rules.mute_sound) === true) {
      policy.muteSound = true;
      used = true;
    }
    if (used) policy.by.push(plugin.id);
  }
  return policy;
}
