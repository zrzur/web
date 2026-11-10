/**
 * Plugin host: decides what may run, runs it, and is the only thing that
 * turns plugin requests into effects. Plugins never touch app state,
 * the DOM, the API client or tokens; they ask the host, and the host
 * checks the granted permissions on every call.
 */
import { createSignal } from "solid-js";
import type { Client } from "@zrzur/sdk/solid";

import {
  type Manifest,
  type PanelBlock,
  type PluginEvent,
  type Platform,
  CONTRAST_PAIRS,
  PLUGIN_API_VERSION,
  THEME_TOKENS,
  compareVersions,
  contrast,
  localise,
  sha256Hex,
} from "../../../plugin-sdk/src/manifest.ts";

import { shortcutFor, shortcutsPaused } from "../keybinds/active";
import { type InstallView, pluginApi } from "./api";
import { pluginsEnabled } from "./enabled";
import {
  type ActivePlugin,
  type DynamicBlock,
  type PluginMessage,
  effectiveSettings,
  has,
  hostHooks,
  plugins,
  resolveBinding,
  safeMode,
  setOpenPanel,
  setPlugins,
  setSafeModeSignal,
  updatePlugin,
} from "./registry";
import { PluginSandbox } from "./sandbox";

/** Version plugins compare `min_app_version` against (Zrzur 26) */
export const ZRZUR_APP_VERSION = "26.0.0";

/** Failures inside this window that quarantine a plugin */
const QUARANTINE_FAILURES = 3;
const QUARANTINE_WINDOW_MS = 10 * 60_000;
/** Start-ups that never became healthy before Safe Mode turns on */
const CRASH_LOOP_BOOTS = 2;
const HEALTHY_AFTER_MS = 20_000;

const PREFS_KEY = "zrzur:plugins:v1";
const BOOT_KEY = "zrzur:plugins:boot";
const STORAGE_PREFIX = "zrzur:plugin-storage:";

export function currentPlatform(): Platform {
  if (typeof window !== "undefined" && (window as { native?: unknown }).native)
    return "desktop";
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  } catch {
    // no matchMedia
  }
  return "web";
}

export type Compatibility = { ok: true } | { ok: false; reason: string };

/** Whether this client can run a manifest at all */
export function compatibility(manifest: Manifest): Compatibility {
  if (manifest.api_version !== PLUGIN_API_VERSION) {
    return { ok: false, reason: "api_version" };
  }
  if (!manifest.platforms.includes(currentPlatform())) {
    return { ok: false, reason: "platform" };
  }
  if (compareVersions(manifest.min_app_version, ZRZUR_APP_VERSION) > 0) {
    return { ok: false, reason: "app_version" };
  }
  if (
    manifest.entrypoint.type === "worker" &&
    (typeof Worker === "undefined" || typeof MessageChannel === "undefined")
  ) {
    return { ok: false, reason: "no_sandbox" };
  }
  return { ok: true };
}

// ------------------------------------------------------------ local prefs

type CrashEntry = { at: number; version: string; reason: string };
type Prefs = {
  safeMode: boolean;
  quarantined: Record<string, string>;
  crashes: Record<string, CrashEntry[]>;
  themeOff: string[];
  accessibilityOff: string[];
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // storage full or blocked: the host keeps working from memory
    return false;
  }
}

const defaultPrefs = (): Prefs => ({
  safeMode: false,
  quarantined: {},
  crashes: {},
  themeOff: [],
  accessibilityOff: [],
});

let prefs: Prefs = defaultPrefs();

export function loadPrefs() {
  prefs = readJson(PREFS_KEY, defaultPrefs());
  return prefs;
}

function savePrefs() {
  writeJson(PREFS_KEY, prefs);
}

export function crashLog(id: string): CrashEntry[] {
  return prefs.crashes[id] ?? [];
}

export function quarantineReason(id: string): string | undefined {
  return prefs.quarantined[id];
}

// ------------------------------------------------------------ host

export type HostDeps = {
  client: () => Client;
  settings: {
    getValue(key: "appearance:compact_mode"): boolean;
    setValue(key: "appearance:compact_mode", value: boolean): void;
  };
  insertText(text: string): void;
  navigate(path: string): void;
  notify(text: string): void;
  locale(): string;
};

type Running = {
  sandbox?: PluginSandbox;
  /** per-plugin rate limit for notices */
  notices: number[];
};

const THEME_STYLE = "zrzur-plugin-theme";
const A11Y_STYLE = "zrzur-plugin-accessibility";

export class PluginHost {
  private running = new Map<string, Running>();
  /** failed this session; not restarted automatically */
  private crashed = new Set<string>();
  private installs = new Map<string, InstallView>();
  private previews = new Map<string, { manifest: Manifest; code?: string }>();
  private keyListener = (event: KeyboardEvent) => this.onKey(event);
  private healthyTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private markClean = () => writeJson(BOOT_KEY, { unhealthy: 0, running: [] });

  /** live instances (diagnostics; there should only ever be one) */
  static live = 0;

  constructor(private deps: HostDeps) {
    PluginHost.live++;
    hostHooks.runCommand = (pluginId, commandId) =>
      void this.runCommand(pluginId, commandId);
    hostHooks.runMessageAction = (pluginId, actionId, message) =>
      void this.runMessageAction(pluginId, actionId, message);
    hostHooks.panelButton = (pluginId, handler) =>
      void this.panelButton(pluginId, handler);
    hostHooks.setSetting = (pluginId, key, value) =>
      void this.setSetting(pluginId, key, value);
    window.addEventListener("keydown", this.keyListener, true);
  }

  /**
   * Start-up: detect crash loops, then load installs. A boot that never
   * became healthy counts; two in a row turn Safe Mode on.
   */
  async boot(options: { forceSafeMode?: boolean } = {}) {
    if (!pluginsEnabled(this.deps.client())) return { autoSafeMode: false };
    loadPrefs();
    const boot = readJson(BOOT_KEY, { unhealthy: 0, running: [] as string[] });
    let auto = false;
    // only starts that ran plugins and never ended cleanly count: a normal
    // reload or closing the tab fires pagehide, a crashed tab does not
    if (
      boot.unhealthy >= CRASH_LOOP_BOOTS &&
      boot.running.length > 0 &&
      !prefs.safeMode
    ) {
      prefs.safeMode = true;
      auto = true;
      for (const id of boot.running) this.recordFailure(id, "?", "crash_loop");
      savePrefs();
    }
    setSafeModeSignal(prefs.safeMode || !!options.forceSafeMode);
    writeJson(BOOT_KEY, { unhealthy: boot.unhealthy + 1, running: [] });
    this.healthyTimer = setTimeout(this.markClean, HEALTHY_AFTER_MS);
    window.addEventListener("pagehide", this.markClean);
    await this.refresh();
    return { autoSafeMode: auto };
  }

  /** Fetch installs from the server and make the running set match */
  async refresh() {
    if (!pluginsEnabled(this.deps.client())) return [];
    const views = await pluginApi.installs(this.deps.client());
    this.installs = new Map(views.map((v) => [v.plugin._id, v]));
    this.touch();
    await this.reconcile();
    return views;
  }

  /** Use a view the server just returned (install, enable...) */
  async apply(view: InstallView) {
    // the user just acted on it (enable, update...): give it another go
    this.crashed.delete(view.plugin._id);
    this.installs.set(view.plugin._id, view);
    this.touch();
    await this.reconcile();
  }

  forget(id: string) {
    this.installs.delete(id);
    this.touch();
    return this.reconcile();
  }

  /** bumped whenever installs change, so screens re-read `views` */
  private installsVersion = createSignal(0);
  private touch() {
    this.installsVersion[1]((n) => n + 1);
  }

  /** reactive: reading it tracks install changes */
  get views() {
    this.installsVersion[0]();
    return [...this.installs.values()];
  }

  /** Why a plugin isn't running, or undefined if it should */
  blockedReason(view: InstallView): string | undefined {
    if (safeMode()) return "safe_mode";
    if (!view.enabled) return "disabled";
    if (view.blocked) return view.blocked;
    const compat = compatibility(view.release.manifest);
    if (!compat.ok) return compat.reason;
    if (prefs.quarantined[view.plugin._id]) return "quarantined";
    // a crashed plugin stays stopped until the user acts on it
    if (this.crashed.has(view.plugin._id)) return "failed";
    return undefined;
  }

  private async reconcile() {
    if (this.disposed) return;
    const wanted = new Set<string>();
    for (const view of this.installs.values()) {
      const id = view.plugin._id;
      const reason = this.blockedReason(view);
      if (!reason) wanted.add(id);
      const current = plugins[id];
      const releaseChanged =
        current && current.manifest.version !== view.release.version;
      if (!current || releaseChanged) {
        if (current) await this.stop(id);
        setPlugins(id, {
          id,
          manifest: view.release.manifest,
          granted: [...view.granted],
          status: "stopped",
          source: "installed",
          official: view.plugin.official,
          settings: { ...view.settings },
          themeOn: !prefs.themeOff.includes(id),
          accessibilityOn: !prefs.accessibilityOff.includes(id),
          workerCommands: [],
          workerMessageActions: [],
          metrics: { calls: 0, errors: 0 },
        });
      } else {
        updatePlugin(id, (p) => {
          p.granted = [...view.granted];
          p.settings = { ...view.settings };
        });
      }
      // a failed plugin keeps its real status and error
      if (reason && reason !== "failed") {
        if (this.running.has(id)) await this.stop(id);
        updatePlugin(id, (p) => {
          p.status =
            reason === "quarantined"
              ? "quarantined"
              : [
                    "platform",
                    "app_version",
                    "api_version",
                    "no_sandbox",
                  ].includes(reason)
                ? "unsupported"
                : [
                      "revoked",
                      "suspended",
                      "removed",
                      "not_approved",
                      "consent",
                      "third_party_code",
                    ].includes(reason)
                  ? "blocked"
                  : "stopped";
          p.error =
            reason === "disabled" || reason === "safe_mode"
              ? undefined
              : reason;
        });
      }
    }
    for (const id of this.previews.keys()) {
      if (!safeMode() && !this.crashed.has(id)) wanted.add(id);
    }
    // stop and forget everything no longer installed
    for (const id of Object.keys(plugins)) {
      if (!this.installs.has(id) && !this.previews.has(id)) {
        await this.stop(id);
        setPlugins(id, undefined!);
      }
    }
    for (const id of wanted) {
      if (!this.running.has(id)) await this.start(id);
    }
    for (const id of [...this.running.keys()]) {
      if (!wanted.has(id)) await this.stop(id);
    }
    this.applyOverlays();
    writeJson(BOOT_KEY, {
      unhealthy: readJson(BOOT_KEY, { unhealthy: 1 }).unhealthy,
      running: [...this.running.keys()],
    });
  }

  private async start(id: string) {
    if (!pluginsEnabled(this.deps.client())) return;
    const plugin = plugins[id];
    if (!plugin) return;
    const started = performance.now();
    const entry: Running = { notices: [] };
    this.running.set(id, entry);
    updatePlugin(id, (p) => {
      p.status = "starting";
      p.error = undefined;
    });

    try {
      if (plugin.manifest.entrypoint.type === "worker") {
        const code =
          this.previews.get(id)?.code ?? this.installs.get(id)?.release.code;
        if (!code) throw new Error("third_party_code");
        // the code must be exactly what was reviewed
        const expected =
          this.installs.get(id)?.release.code_sha256 ??
          plugin.manifest.integrity?.sha256;
        if (!expected || (await sha256Hex(code)) !== expected) {
          throw new Error("integrity");
        }
        const sandbox = new PluginSandbox({
          onCall: (call) => this.onCall(id, call.method, call.args),
          onFailure: (reason) => this.failed(id, reason),
          onLog: (_level, text) => console.warn(`[plugin ${id}]`, text),
        });
        entry.sandbox = sandbox;
        const ms = await sandbox.start(code, {
          manifest: plugin.manifest,
          locale: this.deps.locale(),
        });
        updatePlugin(id, (p) => (p.metrics.activationMs = Math.round(ms)));
      } else {
        updatePlugin(
          id,
          (p) =>
            (p.metrics.activationMs = Math.round(performance.now() - started)),
        );
      }
      if (!this.running.has(id)) return;
      updatePlugin(id, (p) => (p.status = "running"));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // the sandbox may have reported this failure already
      if (this.running.has(id)) this.failed(id, reason);
    }
  }

  private async stop(id: string) {
    const entry = this.running.get(id);
    this.running.delete(id);
    if (entry?.sandbox) await entry.sandbox.stop();
    updatePlugin(id, (p) => {
      if (p.status === "running" || p.status === "starting")
        p.status = "stopped";
      p.workerCommands = [];
      p.workerMessageActions = [];
    });
    setOpenPanel((panel) => (panel?.pluginId === id ? null : panel));
  }

  private recordFailure(id: string, version: string, reason: string) {
    const now = Date.now();
    const log = (prefs.crashes[id] ?? []).filter(
      (c) => now - c.at < 7 * 24 * 3600_000,
    );
    // no user data: id, version, a short reason and a time
    log.push({ at: now, version, reason: reason.slice(0, 120) });
    prefs.crashes[id] = log.slice(-20);
    const recent = log.filter((c) => now - c.at < QUARANTINE_WINDOW_MS);
    if (recent.length >= QUARANTINE_FAILURES)
      prefs.quarantined[id] = reason.slice(0, 120);
    savePrefs();
    return !!prefs.quarantined[id];
  }

  private failed(id: string, reason: string) {
    this.crashed.add(id);
    const entry = this.running.get(id);
    this.running.delete(id);
    entry?.sandbox?.destroy();
    const plugin = plugins[id];
    if (!plugin) return;
    const quarantined = this.recordFailure(id, plugin.manifest.version, reason);
    updatePlugin(id, (p) => {
      p.status = quarantined ? "quarantined" : "failed";
      p.error = reason;
      p.metrics.errors++;
      p.workerCommands = [];
      p.workerMessageActions = [];
    });
    setOpenPanel((panel) => (panel?.pluginId === id ? null : panel));
    this.applyOverlays();
  }

  /** Clear quarantine and crash history, then try again */
  async retry(id: string) {
    this.crashed.delete(id);
    delete prefs.quarantined[id];
    delete prefs.crashes[id];
    savePrefs();
    await this.stop(id);
    await this.reconcile();
  }

  async setSafeMode(on: boolean) {
    prefs.safeMode = on;
    savePrefs();
    setSafeModeSignal(on);
    await this.reconcile();
  }

  // ---------------------------------------------------------- preview

  /** Run a developer's local package without installing it */
  async preview(manifest: Manifest, code?: string) {
    const id = manifest.id;
    if (this.installs.has(id)) throw new Error("installed");
    if (manifest.entrypoint.type === "worker" && !import.meta.env.DEV) {
      throw new Error("worker_preview_dev_only");
    }
    await this.stopPreview(id);
    this.crashed.delete(id);
    this.previews.set(id, { manifest, code });
    setPlugins(id, {
      id,
      manifest,
      granted: [...manifest.permissions],
      status: "stopped",
      source: "preview",
      official: false,
      settings: {},
      themeOn: true,
      accessibilityOn: true,
      workerCommands: [],
      workerMessageActions: [],
      metrics: { calls: 0, errors: 0 },
    });
    await this.reconcile();
  }

  async stopPreview(id: string) {
    if (!this.previews.delete(id)) return;
    await this.reconcile();
  }

  // ---------------------------------------------------------- overlays

  /**
   * Rebuild the theme and accessibility style elements from running
   * plugins. All CSS is generated here from validated values; a plugin
   * can never supply CSS text, selectors or warning colours.
   */
  applyOverlays() {
    const active = Object.values(plugins).filter((p) => p.status === "running");
    const colours: Record<string, string> = {};
    for (const plugin of active) {
      const theme = plugin.manifest.contributes?.theme;
      if (!theme || !plugin.themeOn || !has(plugin, "theme.colors")) continue;
      for (const token of THEME_TOKENS) {
        const value = resolveBinding<string>(plugin, theme.colors[token]);
        if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
          colours[token] = value.toLowerCase();
        }
      }
    }
    // keep text readable: drop any pair that fails contrast against the
    // colours actually in use
    if (Object.keys(colours).length) {
      const computed = getComputedStyle(document.body);
      const current = (token: string) => {
        if (colours[token]) return colours[token];
        const value = computed
          .getPropertyValue(`--md-sys-color-${token}`)
          .trim();
        return /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
      };
      for (const [fg, bg, min] of CONTRAST_PAIRS) {
        if (!colours[fg] && !colours[bg]) continue;
        const a = current(fg);
        const b = current(bg);
        if (a && b && contrast(a, b) < min) {
          delete colours[fg];
          delete colours[bg];
        }
      }
    }
    setStyle(
      THEME_STYLE,
      Object.keys(colours).length
        ? `body{${Object.entries(colours)
            .map(
              ([token, value]) =>
                `--md-sys-color-${token}:${value} !important;`,
            )
            .join("")}${zrzurTokens(colours)
            .map(([token, value]) => `${token}:${value} !important;`)
            .join("")}}`
        : "",
    );

    let css = "";
    for (const plugin of active) {
      const a11y = plugin.manifest.contributes?.accessibility;
      if (
        !a11y ||
        !plugin.accessibilityOn ||
        !has(plugin, "accessibility.display")
      )
        continue;
      const num = (v: unknown, min: number, max: number) => {
        const n = resolveBinding<number>(plugin, v);
        return typeof n === "number" && n >= min && n <= max ? n : undefined;
      };
      const flag = (v: unknown) => resolveBinding<boolean>(plugin, v) === true;
      const scale = num(a11y.font_scale, 0.85, 1.5);
      if (scale)
        css += `html{font-size:${(scale * 100).toFixed(1)}% !important;}`;
      const lineHeight = num(a11y.line_height, 1.2, 2);
      if (lineHeight) css += `body{line-height:${lineHeight} !important;}`;
      const spacing = num(a11y.letter_spacing, 0, 0.12);
      if (spacing !== undefined)
        css += `body{letter-spacing:${spacing}em !important;}`;
      if (flag(a11y.underline_links))
        css += `a{text-decoration:underline !important;}`;
      if (flag(a11y.focus_ring)) {
        css += `:focus-visible{outline:3px solid var(--md-sys-color-primary) !important;outline-offset:2px !important;}`;
      }
      if (flag(a11y.reduce_motion)) {
        css += `*,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}`;
      }
    }
    setStyle(A11Y_STYLE, css);
  }

  toggleContribution(id: string, kind: "theme" | "accessibility") {
    const list = kind === "theme" ? prefs.themeOff : prefs.accessibilityOff;
    const index = list.indexOf(id);
    if (index === -1) list.push(id);
    else list.splice(index, 1);
    savePrefs();
    updatePlugin(id, (p) => {
      if (kind === "theme") p.themeOn = index !== -1;
      else p.accessibilityOn = index !== -1;
    });
    this.applyOverlays();
  }

  // ---------------------------------------------------------- commands

  private label(plugin: ActivePlugin) {
    const locale = this.deps.locale();
    return localise(
      plugin.manifest.locales?.[locale.split("-")[0]]?.name ??
        plugin.manifest.name,
      locale,
    );
  }

  /** In-app notice, always prefixed with the plugin's name, rate-limited */
  private notice(id: string, text: string) {
    const plugin = plugins[id];
    const entry = this.running.get(id);
    if (!plugin || !entry) throw new Error("not running");
    const now = Date.now();
    entry.notices = entry.notices.filter((t) => now - t < 10_000);
    if (entry.notices.length >= 3) throw new Error("rate_limited");
    entry.notices.push(now);
    this.deps.notify(`${this.label(plugin)}: ${text.slice(0, 140)}`);
  }

  async runCommand(id: string, commandId: string) {
    const plugin = plugins[id];
    if (!plugin || plugin.status !== "running") return;
    const command = plugin.manifest.contributes?.commands?.find(
      (c) => c.id === commandId,
    );
    if (!command || !has(plugin, "ui.commands")) return;
    const action = command.action;
    try {
      switch (action.type) {
        case "setting.toggle":
          if (
            !has(plugin, "app.preferences") ||
            action.key !== "appearance:compact_mode"
          )
            return;
          this.deps.settings.setValue(
            action.key,
            !this.deps.settings.getValue(action.key),
          );
          break;
        case "theme.toggle":
          this.toggleContribution(id, "theme");
          break;
        case "accessibility.toggle":
          this.toggleContribution(id, "accessibility");
          break;
        case "panel.open":
          if (!has(plugin, "ui.panels")) return;
          setOpenPanel({ pluginId: id, kind: "static", panelId: action.panel });
          break;
        case "notify":
          if (!has(plugin, "notifications.show")) return;
          this.notice(id, localise(action.text, this.deps.locale()));
          break;
        case "composer.insert":
          if (!has(plugin, "composer.insert")) return;
          this.deps.insertText(action.text.slice(0, 2000));
          break;
        case "navigate":
          this.deps.navigate(
            { home: "/app", friends: "/friends", discover: "/discover" }[
              action.to
            ] ?? "/app",
          );
          break;
        case "worker":
          await this.invoke(id, "command", action.handler);
          break;
      }
    } catch (error) {
      updatePlugin(id, (p) => p.metrics.errors++);
      console.warn(`[plugin ${id}] command ${commandId} failed`, error);
    }
  }

  private async invoke(
    id: string,
    kind: "command" | "message_action" | "event" | "panel_button",
    handler: string,
    payload?: unknown,
  ) {
    const sandbox = this.running.get(id)?.sandbox;
    if (!sandbox?.alive) throw new Error("not running");
    updatePlugin(id, (p) => p.metrics.calls++);
    try {
      return await sandbox.invoke(kind, handler, payload);
    } catch (error) {
      updatePlugin(id, (p) => p.metrics.errors++);
      if (error instanceof Error && error.message === "timeout") {
        // a slow handler counts as a failure but doesn't stop the plugin
        if (
          this.recordFailure(
            id,
            plugins[id]?.manifest.version ?? "?",
            "slow_handler",
          )
        ) {
          this.failed(id, "slow_handler");
        }
      }
      throw error;
    } finally {
      updatePlugin(
        id,
        (p) => (p.metrics.lastLatencyMs = sandbox.lastLatencyMs),
      );
    }
  }

  async runMessageAction(id: string, actionId: string, message: PluginMessage) {
    const plugin = plugins[id];
    if (
      !plugin ||
      plugin.status !== "running" ||
      !has(plugin, "context.message.selected")
    )
      return;
    const action = plugin.manifest.contributes?.message_actions?.find(
      (a) => a.id === actionId,
    );
    if (!action) return;
    await this.invoke(id, "message_action", action.handler, {
      id: message.id,
      channel_id: message.channel_id,
      content: message.content.slice(0, 4000),
      author_name: message.author_name.slice(0, 64),
      created_at: message.created_at,
    }).catch(() => void 0);
  }

  async panelButton(id: string, handler: string) {
    await this.invoke(id, "panel_button", handler).catch(() => void 0);
  }

  /** Send an app event to running plugins that subscribed and may see it */
  emit(
    event: "channel.switch" | "app.locale_change" | "app.theme_change",
    payload: unknown,
  ) {
    for (const plugin of Object.values(plugins)) {
      if (
        plugin.status !== "running" ||
        plugin.manifest.entrypoint.type !== "worker"
      )
        continue;
      if (!plugin.manifest.contributes?.events?.includes(event)) continue;
      if (event === "channel.switch" && !has(plugin, "context.channel"))
        continue;
      void this.invoke(plugin.id, "event", event, payload).catch(() => void 0);
    }
  }

  async setSetting(id: string, key: string, value: unknown) {
    const plugin = plugins[id];
    if (!plugin || !has(plugin, "storage.settings")) return;
    const next = { ...plugin.settings, [key]: value };
    if (plugin.source === "installed") {
      const saved = await pluginApi.saveSettings(this.deps.client(), id, next);
      updatePlugin(id, (p) => (p.settings = saved));
      const view = this.installs.get(id);
      if (view) view.settings = saved;
    } else {
      updatePlugin(id, (p) => (p.settings = next));
    }
    this.running
      .get(id)
      ?.sandbox?.settingsChanged(effectiveSettings(plugins[id]));
    this.applyOverlays();
  }

  /** Device storage of a plugin, separate for every account on this device */
  private storageKey(id: string) {
    return `${STORAGE_PREFIX}${this.deps.client().user?.id ?? "signed-out"}:${id}`;
  }

  // ---------------------------------------------------------- SDK calls

  /** Every SDK call from a sandbox lands here; permissions are checked per call */
  private async onCall(
    id: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const plugin = plugins[id];
    if (!plugin) throw new Error("unknown plugin");
    const need = (permission: string) => {
      if (!has(plugin, permission))
        throw new Error(`permission_denied: ${permission}`);
    };
    const str = (value: unknown, max: number) =>
      typeof value === "string" ? value.slice(0, max) : "";
    updatePlugin(id, (p) => p.metrics.calls++);

    switch (method) {
      case "register": {
        const [kind, name] = args.map((a) => str(a, 40));
        // events have dotted names (`channel.switch`); handlers don't
        if (kind === "event") {
          if (!plugin.manifest.contributes?.events?.includes(name as PluginEvent)) {
            throw new Error("undeclared event");
          }
          return true;
        }
        if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) throw new Error("bad name");
        if (kind === "command") {
          const declared = plugin.manifest.contributes?.commands?.some(
            (c) => c.action.type === "worker" && c.action.handler === name,
          );
          if (!declared) throw new Error("undeclared command");
          updatePlugin(id, (p) => {
            if (!p.workerCommands.includes(name)) p.workerCommands.push(name);
          });
        } else if (kind === "message_action") {
          need("context.message.selected");
          const declared = plugin.manifest.contributes?.message_actions?.some(
            (a) => a.handler === name,
          );
          if (!declared) throw new Error("undeclared message action");
          updatePlugin(id, (p) => {
            if (!p.workerMessageActions.includes(name))
              p.workerMessageActions.push(name);
          });
        } else if (kind !== "panel_button") {
          throw new Error("bad kind");
        }
        return true;
      }
      case "notifications.show":
        need("notifications.show");
        this.notice(id, str(args[0], 140));
        return true;
      case "composer.insert":
        need("composer.insert");
        this.deps.insertText(str(args[0], 2000));
        return true;
      case "ui.showPanel": {
        need("ui.panels");
        const panel = args[0] as { title?: unknown; blocks?: unknown };
        const blocks = sanitiseBlocks(panel?.blocks);
        if (!blocks) throw new Error("invalid panel");
        setOpenPanel({
          pluginId: id,
          kind: "dynamic",
          title:
            typeof panel.title === "string"
              ? panel.title.slice(0, 60)
              : plugin.manifest.name,
          blocks,
        });
        return true;
      }
      case "settings.get":
        need("storage.settings");
        return effectiveSettings(plugin);
      case "settings.set":
        need("storage.settings");
        await this.setSetting(id, str(args[0], 32), args[1]);
        return true;
      case "storage.get": {
        need("storage.settings");
        const all = readJson<Record<string, unknown>>(this.storageKey(id), {});
        const key = str(args[0], 64);
        return Object.hasOwn(all, key) ? all[key] : null;
      }
      case "storage.set": {
        need("storage.settings");
        const all = readJson<Record<string, unknown>>(this.storageKey(id), {});
        // an own property even for keys like "__proto__"
        Object.defineProperty(all, str(args[0], 64), {
          value: args[1],
          enumerable: true,
          configurable: true,
          writable: true,
        });
        const text = JSON.stringify(all);
        if (text.length > 64 * 1024) throw new Error("storage_full");
        if (!writeJson(this.storageKey(id), all))
          throw new Error("storage_unavailable");
        return true;
      }
      case "diagnostics.get":
        need("devtools.diagnostics");
        if (!import.meta.env.DEV) throw new Error("development builds only");
        return {
          app_version: ZRZUR_APP_VERSION,
          platform: currentPlatform(),
          plugins: Object.values(plugins).map((p) => ({
            id: p.id,
            status: p.status,
            activation_ms: p.metrics.activationMs,
            calls: p.metrics.calls,
            errors: p.metrics.errors,
          })),
        };
      case "log":
        console.info(`[plugin ${id}]`, str(args[0], 1000));
        return true;
      default:
        throw new Error(`unknown method ${method.slice(0, 40)}`);
    }
  }

  // ---------------------------------------------------------- keybinds

  private onKey(event: KeyboardEvent) {
    if (event.repeat || safeMode()) return;
    // AltGr arrives as Ctrl+Alt: on many keyboards it types @, €, { and
    // letters, which must always reach the text box, never a plugin
    if (event.getModifierState?.("AltGraph")) return;
    // the physical key: Alt changes event.key on macOS
    const key =
      /^(?:Key([A-Z])|Digit([0-9]))$/
        .exec(event.code)
        ?.slice(1)
        .find(Boolean) ?? "";
    if (!key) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const combo =
      ctrl && event.shiftKey
        ? `Ctrl+Shift+${key}`
        : event.altKey && event.shiftKey
          ? `Alt+Shift+${key}`
          : ctrl && event.altKey
            ? `Ctrl+Alt+${key}`
            : null;
    if (!combo) return;
    // the person's own app shortcuts (changed in Ctrl+/) always win
    if (shortcutsPaused() || shortcutFor(event)) return;
    for (const plugin of Object.values(plugins)) {
      if (plugin.status !== "running" || !has(plugin, "keybinds")) continue;
      const bind = plugin.manifest.contributes?.keybinds?.find(
        (k) => k.keys === combo,
      );
      if (bind) {
        event.preventDefault();
        void this.runCommand(plugin.id, bind.command);
        return;
      }
    }
  }

  /** Stop everything; nothing is left behind (listeners, frames, styles) */
  async dispose() {
    if (!this.disposed) PluginHost.live--;
    this.disposed = true;
    clearTimeout(this.healthyTimer);
    window.removeEventListener("keydown", this.keyListener, true);
    window.removeEventListener("pagehide", this.markClean);
    for (const id of [...this.running.keys()]) await this.stop(id);
    setStyle(THEME_STYLE, "");
    setStyle(A11Y_STYLE, "");
    hostHooks.runCommand = () => void 0;
    hostHooks.runMessageAction = () => void 0;
    hostHooks.panelButton = () => void 0;
    hostHooks.setSetting = () => void 0;
    setOpenPanel(null);
    for (const id of Object.keys(plugins)) setPlugins(id, undefined!);
  }

  /** For tests and diagnostics: what is attached to the page right now */
  static footprint() {
    return {
      frames: document.querySelectorAll("iframe[data-zrzur-plugin-sandbox]")
        .length,
      themeCss: document.getElementById(THEME_STYLE)?.textContent ?? "",
      accessibilityCss: document.getElementById(A11Y_STYLE)?.textContent ?? "",
    };
  }
}

/**
 * The app draws with its own `--z-*` tokens, so a theme's colours are also
 * given to the matching ones. Tokens the app builds from these (the channel
 * list from the sidebar, hovers from the accent) follow by themselves.
 * Warning, danger and status colours are never touched.
 */
const ZRZUR_TOKENS: Record<string, string[]> = {
  primary: [
    "--z-accent",
    "--z-accent-fill",
    "--z-accent-strong",
    "--z-accent-text",
    "--z-icon-accent",
  ],
  background: ["--z-bg-app", "--z-bg-frame", "--z-bg-rail"],
  surface: ["--z-bg-chat"],
  "surface-container-low": ["--z-bg-sidebar"],
  // server icons in the rail
  "surface-container": ["--z-slate-1"],
  "surface-container-high": ["--z-bg-raised", "--z-bg-floating"],
  // message box and account panel share the input surface
  "surface-container-highest": ["--z-bg-input", "--z-bg-dock"],
  // the selected channel / conversation
  "primary-container": ["--z-nav-selected"],
  "on-surface": ["--z-fg-primary", "--z-header-primary"],
  "on-surface-variant": ["--z-fg-secondary"],
  outline: ["--z-border-strong"],
  "outline-variant": ["--z-border-soft", "--z-border-subtle"],
};

export function zrzurTokens(colours: Record<string, string>) {
  const out: [string, string][] = [];
  for (const [token, targets] of Object.entries(ZRZUR_TOKENS)) {
    const value = colours[token];
    if (value) for (const target of targets) out.push([target, value]);
  }
  const accent = colours.primary;
  if (accent) {
    out.push(
      ["--z-accent-hover", `color-mix(in srgb, ${accent} 88%, white)`],
      ["--z-accent-pressed", `color-mix(in srgb, ${accent} 85%, black)`],
      ["--z-accent-muted", `color-mix(in srgb, ${accent} 16%, transparent)`],
    );
  }
  if (colours["on-primary"]) out.push(["--z-on-accent", colours["on-primary"]]);
  return out;
}

function setStyle(id: string, css: string) {
  let element = document.getElementById(id) as HTMLStyleElement | null;
  if (!css) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("style");
    element.id = id;
    document.head.appendChild(element);
  }
  if (element.textContent !== css) element.textContent = css;
}

/** Accept only the structured block types, with bounded text */
export function sanitiseBlocks(input: unknown): DynamicBlock[] | null {
  if (!Array.isArray(input) || input.length > 40) return null;
  const blocks: DynamicBlock[] = [];
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const block = raw as Record<string, unknown>;
    switch (block.type) {
      case "heading":
      case "text": {
        const t = text(block.text, block.type === "text" ? 600 : 60);
        if (!t) return null;
        blocks.push({
          type: block.type,
          text: t,
        } as PanelBlock as DynamicBlock);
        break;
      }
      case "divider":
        blocks.push({ type: "divider" });
        break;
      case "button": {
        const label = text(block.label, 60);
        const handler = typeof block.handler === "string" ? block.handler : "";
        if (!label || !/^[a-z][a-z0-9-]{0,39}$/.test(handler)) return null;
        blocks.push({ type: "button", label, handler });
        break;
      }
      default:
        return null;
    }
  }
  return blocks;
}
