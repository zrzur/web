/**
 * The `zrzur` object a worker plugin receives. It is the only API in the
 * sandbox: there is no network, DOM, storage, eval or Node.js. Every call
 * is checked against the permissions the user granted; a missing
 * permission rejects with `permission_denied: <permission>`.
 *
 * Handlers must answer within 3 seconds and the plugin must answer
 * heartbeats, or the host stops it. At most 60 messages a second, each at
 * most 64 KB of JSON.
 */

export type SelectedMessage = {
  id: string;
  channel_id: string;
  content: string;
  author_name: string;
  /** milliseconds since the epoch */
  created_at: number;
};

export type PanelBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "divider" }
  | { type: "button"; label: string; handler: string };

export type ChannelSwitch = {
  channel_id: string;
  server_id: string | null;
  name: string | null;
};

export interface ZrzurPluginApi {
  /** the plugin's validated manifest */
  readonly manifest: Readonly<Record<string, unknown>>;
  /** the user's language, e.g. `ar` or `en-GB` */
  readonly locale: string;

  commands: {
    /** handle a command declared with `{ "type": "worker", "handler": name }` (ui.commands) */
    register(handler: string, run: () => void | Promise<void>): Promise<boolean>;
  };
  messageActions: {
    /** handle a declared message action (context.message.selected) */
    register(
      handler: string,
      run: (message: SelectedMessage) => void | Promise<void>,
    ): Promise<boolean>;
  };
  /** registrations resolve once the host accepts them and reject if the manifest doesn't declare them */
  events: {
    on(event: "channel.switch", run: (event: ChannelSwitch) => void): void;
    on(
      event: "app.locale_change",
      run: (event: { locale: string }) => void,
    ): void;
    on(event: "app.theme_change", run: () => void): void;
  };
  notifications: {
    /** a short in-app notice, prefixed with the plugin's name; 3 per 10 s (notifications.show) */
    show(text: string): Promise<boolean>;
  };
  composer: {
    /** insert text at the cursor of the message box; never sends (composer.insert) */
    insert(text: string): Promise<boolean>;
  };
  ui: {
    /** show the plugin's side panel (ui.panels) */
    showPanel(panel: { title: string; blocks: PanelBlock[] }): Promise<boolean>;
    /** handle a `button` block of a panel shown with showPanel */
    onButton(handler: string, run: () => void | Promise<void>): Promise<boolean>;
  };
  settings: {
    /** the user's settings for this plugin (storage.settings) */
    get(): Promise<Record<string, unknown>>;
    set(key: string, value: unknown): Promise<boolean>;
    onChange(run: (values: Record<string, unknown>) => void): void;
  };
  storage: {
    /** small key/value store on this device, 64 KB in total (storage.settings) */
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<boolean>;
  };
  diagnostics: {
    /** app version, platform and plugin timings; development builds only (devtools.diagnostics) */
    get(): Promise<Record<string, unknown>>;
  };
  log(...parts: unknown[]): void;
  /** run before the plugin is stopped (disable, update, uninstall) */
  onDeactivate(run: () => void | Promise<void>): void;
}

declare global {
  const zrzur: ZrzurPluginApi;
}
