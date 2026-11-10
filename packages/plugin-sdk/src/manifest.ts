/**
 * Zrzur plugin manifest v1: types, permission catalogue and validator.
 *
 * This file is the single source of truth on the client side: the web
 * client's plugin host, the `zrzur-plugin` CLI and the docs all use it.
 * The backend has a Rust mirror (`revolt-database` `models/plugins/logic.rs`)
 * that enforces the same rules again on submission; the server never trusts
 * a client-side validation result.
 *
 * No dependencies and only erasable TypeScript, so Node can run it directly.
 */

export const MANIFEST_VERSION = 1;
export const PLUGIN_API_VERSION = 1;

/** Hard limits, shared with the backend */
export const LIMITS = {
  manifestBytes: 64 * 1024,
  codeBytes: 256 * 1024,
  commands: 20,
  keybinds: 10,
  settings: 20,
  panels: 5,
  panelBlocks: 40,
  messageActions: 5,
  locales: 40,
  localeStrings: 200,
  textShort: 60,
  textLong: 300,
  insertText: 2000,
  settingsBytes: 8 * 1024,
  storageBytes: 64 * 1024,
} as const;

export type Platform = "web" | "pwa" | "desktop";
export const PLATFORMS: Platform[] = ["web", "pwa", "desktop"];

export type Category =
  | "appearance"
  | "productivity"
  | "accessibility"
  | "notifications"
  | "integration"
  | "developer";
export const CATEGORIES: Category[] = [
  "appearance",
  "productivity",
  "accessibility",
  "notifications",
  "integration",
  "developer",
];

export type Risk = "low" | "medium" | "high";

/**
 * Permission catalogue. `supported: false` means the id is reserved and
 * documented but this version of Zrzur refuses it.
 */
export const PERMISSIONS = {
  "ui.commands": {
    risk: "low",
    supported: true,
    summary: "Add commands you can run from the plugin page or a shortcut",
  },
  "ui.panels": {
    risk: "low",
    supported: true,
    summary: "Show its own panels made of text, buttons and toggles",
  },
  keybinds: {
    risk: "low",
    supported: true,
    summary: "Add keyboard shortcuts (never ones Zrzur or the browser use)",
  },
  "theme.colors": {
    risk: "low",
    supported: true,
    summary:
      "Change interface colours (contrast-checked, never warning colours)",
  },
  "accessibility.display": {
    risk: "low",
    supported: true,
    summary: "Change text size, spacing, link underlines and motion",
  },
  "app.preferences": {
    risk: "low",
    supported: true,
    summary: "Toggle compact mode",
  },
  "storage.settings": {
    risk: "low",
    supported: true,
    summary: "Save its own settings (up to 8 KB)",
  },
  "notifications.show": {
    risk: "low",
    supported: true,
    summary: "Show short in-app notices, labelled with the plugin's name",
  },
  "notifications.display": {
    risk: "medium",
    supported: true,
    summary:
      "Change how Zrzur notifications look and sound (quiet hours, hidden previews); never reads them",
  },
  "composer.insert": {
    risk: "medium",
    supported: true,
    summary: "Insert text into your message box (you still decide to send)",
  },
  "context.channel": {
    risk: "medium",
    supported: true,
    summary:
      "Know the id and name of the channel you open (only channels you can see)",
  },
  "context.message.selected": {
    risk: "medium",
    supported: true,
    summary: "Read one message, only when you pick the plugin's action on it",
  },
  "devtools.diagnostics": {
    risk: "medium",
    supported: true,
    summary:
      "Read app version, platform, connection state and plugin timings (development builds only)",
  },
  "network.fetch": {
    risk: "high",
    supported: false,
    summary: "Reserved: contact external services (not available yet)",
  },
  "integration.oauth": {
    risk: "high",
    supported: false,
    summary:
      "Reserved: connect an external account you authorise (not available yet)",
  },
} as const satisfies Record<
  string,
  { risk: Risk; supported: boolean; summary: string }
>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Never grantable, whatever a manifest says. Listed so validators can give
 * a precise error instead of "unknown permission".
 */
export const FORBIDDEN_PERMISSIONS = [
  "messages.read_all",
  "messages.read",
  "channels.hidden",
  "auth.token",
  "auth.session",
  "auth.password",
  "auth.mfa",
  "bots.token",
  "payments",
  "billing",
  "fs",
  "filesystem",
  "shell",
  "native",
  "node",
  "ipc",
  "eval",
  "dom",
  "cookies",
  "storage.local",
  "network.unrestricted",
  "admin",
] as const;

/** Colour tokens a theme may set (`--md-sys-color-<token>`) */
export const THEME_TOKENS = [
  "primary",
  "on-primary",
  "primary-container",
  "on-primary-container",
  "secondary",
  "on-secondary",
  "secondary-container",
  "on-secondary-container",
  "tertiary",
  "on-tertiary",
  "tertiary-container",
  "on-tertiary-container",
  "background",
  "on-background",
  "surface",
  "on-surface",
  "surface-variant",
  "on-surface-variant",
  "surface-container-lowest",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
  "outline",
  "outline-variant",
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

/** Warning and error colours stay Zrzur's own */
export const RESERVED_THEME_TOKENS = [
  "error",
  "on-error",
  "error-container",
  "on-error-container",
  "shadow",
  "scrim",
];

/**
 * Foreground / background pairs and the minimum contrast between them.
 * Text on surfaces needs WCAG AA (4.5:1); accents need 3:1.
 */
export const CONTRAST_PAIRS: [ThemeToken, ThemeToken, number][] = [
  ["on-surface", "surface", 4.5],
  ["on-surface", "surface-container", 4.5],
  ["on-surface", "surface-container-low", 4.5],
  ["on-surface", "surface-container-high", 4.5],
  ["on-surface", "surface-container-highest", 4.5],
  ["on-background", "background", 4.5],
  ["on-surface-variant", "surface-variant", 3],
  ["on-primary", "primary", 3],
  ["on-primary-container", "primary-container", 3],
  ["on-secondary", "secondary", 3],
  ["on-secondary-container", "secondary-container", 3],
  ["on-tertiary", "tertiary", 3],
  ["on-tertiary-container", "tertiary-container", 3],
];

export type LocalText = string | Record<string, string>;

export type CommandAction =
  | { type: "setting.toggle"; key: "appearance:compact_mode" }
  | { type: "theme.toggle" }
  | { type: "accessibility.toggle" }
  | { type: "panel.open"; panel: string }
  | { type: "notify"; text: LocalText }
  | { type: "composer.insert"; text: string }
  | { type: "navigate"; to: "home" | "friends" | "discover" }
  | { type: "worker"; handler: string };

export const NAVIGATE_TARGETS = ["home", "friends", "discover"] as const;
export const TOGGLEABLE_SETTINGS = ["appearance:compact_mode"] as const;

export type Command = { id: string; title: LocalText; action: CommandAction };
export type Keybind = { command: string; keys: string };

export type SettingDefinition =
  | {
      key: string;
      type: "boolean";
      title: LocalText;
      description?: LocalText;
      default: boolean;
    }
  | {
      key: string;
      type: "text";
      title: LocalText;
      description?: LocalText;
      default: string;
      max_length?: number;
    }
  | {
      key: string;
      type: "number";
      title: LocalText;
      description?: LocalText;
      default: number;
      min: number;
      max: number;
      step?: number;
    }
  | {
      key: string;
      type: "select";
      title: LocalText;
      description?: LocalText;
      default: string;
      options: { value: string; label: LocalText }[];
    }
  | {
      key: string;
      type: "color";
      title: LocalText;
      description?: LocalText;
      default: string;
    }
  | {
      key: string;
      type: "time";
      title: LocalText;
      description?: LocalText;
      default: string;
    };

/** A literal value or a reference to one of the plugin's settings */
export type Bindable<T> = T | `$setting:${string}`;

export type ThemeContribution = {
  colors: Partial<Record<ThemeToken, Bindable<string>>>;
};

export type AccessibilityContribution = {
  font_scale?: Bindable<number>;
  line_height?: Bindable<number>;
  letter_spacing?: Bindable<number>;
  underline_links?: Bindable<boolean>;
  reduce_motion?: Bindable<boolean>;
  focus_ring?: Bindable<boolean>;
};

export type NotificationsContribution = {
  quiet_hours?: { start: Bindable<string>; end: Bindable<string> };
  /** turn quiet hours on or off with a setting */
  quiet_hours_enabled?: Bindable<boolean>;
  hide_previews?: Bindable<boolean>;
  mute_sound?: Bindable<boolean>;
};

export type PanelBlock =
  | { type: "heading"; text: LocalText }
  | { type: "text"; text: LocalText }
  | { type: "divider" }
  | { type: "button"; label: LocalText; command: string }
  | { type: "setting"; key: string };

export type Panel = { id: string; title: LocalText; blocks: PanelBlock[] };

export type MessageAction = { id: string; title: LocalText; handler: string };

export type PluginEvent =
  | "channel.switch"
  | "app.locale_change"
  | "app.theme_change";
export const PLUGIN_EVENTS: PluginEvent[] = [
  "channel.switch",
  "app.locale_change",
  "app.theme_change",
];

export type Contributes = {
  theme?: ThemeContribution;
  accessibility?: AccessibilityContribution;
  notifications?: NotificationsContribution;
  commands?: Command[];
  keybinds?: Keybind[];
  settings?: SettingDefinition[];
  panels?: Panel[];
  message_actions?: MessageAction[];
  events?: PluginEvent[];
};

export type Entrypoint =
  | { type: "declarative" }
  | { type: "worker"; file: string };

export type Manifest = {
  manifest_version: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  author: { name: string; url?: string };
  category: Category;
  icon?: string;
  api_version: 1;
  min_app_version: string;
  platforms: Platform[];
  entrypoint: Entrypoint;
  permissions: Permission[];
  contributes?: Contributes;
  locales?: Record<
    string,
    { name?: string; description?: string; strings?: Record<string, string> }
  >;
  integrity?: { sha256: string };
};

/** A plugin package as the CLI writes it and the API receives it */
export type PluginPackage = { manifest: Manifest; code?: string };

export type ValidationIssue = { path: string; message: string };

export type ValidationResult =
  | { ok: true; manifest: Manifest; risk: Risk; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

const ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,4}$/;
const SEMVER_RE =
  /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})(-[0-9A-Za-z.-]{1,20})?$/;
const LOCAL_ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
const SETTING_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const ICON_RE = /^[a-z0-9_-]{1,40}$/;
const FILE_RE = /^[a-z0-9_-]{1,40}\.js$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const KEYS_RE = /^(Ctrl\+Shift|Alt\+Shift|Ctrl\+Alt)\+[A-Z0-9]$/;
const BINDING_RE = /^\$setting:([a-z][a-z0-9_]{0,31})$/;

/** Shortcuts browsers, devtools or Zrzur already use */
export const RESERVED_KEYS = [
  "Ctrl+Shift+I",
  "Ctrl+Shift+J",
  "Ctrl+Shift+C",
  "Ctrl+Shift+R",
  "Ctrl+Shift+N",
  "Ctrl+Shift+T",
  "Ctrl+Shift+W",
  "Ctrl+Shift+Q",
  "Ctrl+Shift+P",
  "Ctrl+Shift+B",
  "Ctrl+Shift+Delete",
  // editing: redo, paste as plain text, Unicode input on Linux
  "Ctrl+Shift+Z",
  "Ctrl+Shift+V",
  "Ctrl+Shift+U",
  // browser tools and menus (Chrome, Firefox, Edge)
  "Ctrl+Shift+K",
  "Ctrl+Shift+E",
  "Ctrl+Shift+M",
  "Ctrl+Shift+O",
  "Ctrl+Shift+A",
  "Ctrl+Shift+D",
  "Ctrl+Shift+S",
  "Ctrl+Shift+Y",
  "Ctrl+Shift+H",
  // Zrzur: Create poll
  "Ctrl+Shift+8",
];

/** Reserved for Zrzur's own plugins */
export const OFFICIAL_PREFIX = "zrzur.";
export const OFFICIAL_PREFIX_LEGACY = "zarzour.";

/** Parse `MAJOR.MINOR.PATCH[-pre]` */
export function parseVersion(version: string) {
  const match = SEMVER_RE.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4]?.slice(1),
  };
}

/** Compare two versions; a pre-release sorts before its release */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (const key of ["major", "minor", "patch"] as const) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Highest risk among the permissions; worker code is always high */
export function riskOf(manifest: Pick<Manifest, "permissions" | "entrypoint">) {
  const order: Risk[] = ["low", "medium", "high"];
  let risk = 0;
  for (const permission of manifest.permissions) {
    const entry = PERMISSIONS[permission as Permission];
    if (entry) risk = Math.max(risk, order.indexOf(entry.risk));
  }
  if (manifest.entrypoint?.type === "worker") risk = 2;
  return order[risk];
}

/** Relative luminance of `#rrggbb` (WCAG 2.x) */
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two `#rrggbb` colours */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a manifest. Unknown keys anywhere are errors, so a manifest can't
 * smuggle in fields a later version might trust.
 */
/** Words only official plugins may use in a name (as the server checks) */
const RESERVED_NAME_WORDS = ["zrzur", "zarzour", "zarzur", "zarzoor", "زرزور", "official", "offiziell", "رسمي"];

/** Whether a third-party name pretends to be Zrzur's own; spaces, marks and case don't hide it */
export function reservedPluginName(text: unknown) {
  if (typeof text !== "string") return false;
  const plain = [...text.toLowerCase()]
    .filter((c) => /\p{L}/u.test(c) && !/[ً-ْـ]/.test(c))
    .join("");
  return RESERVED_NAME_WORDS.some((word) => plain.includes(word));
}

export function validateManifest(
  input: unknown,
  options: { code?: string; official?: boolean } = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ path, message });

  if (!isObject(input)) {
    return { ok: false, issues: [{ path: "", message: "must be an object" }] };
  }

  let serialised = "";
  try {
    serialised = JSON.stringify(input);
  } catch {
    return {
      ok: false,
      issues: [{ path: "", message: "must be plain JSON" }],
    };
  }
  if (utf8Length(serialised) > LIMITS.manifestBytes) {
    fail("", `manifest is larger than ${LIMITS.manifestBytes} bytes`);
  }

  const known = (
    object: Record<string, unknown>,
    path: string,
    keys: string[],
  ) => {
    for (const key of Object.keys(object)) {
      if (!keys.includes(key)) {
        fail(
          path ? `${path}.${key}` : key,
          key === "dependencies" || key === "scripts"
            ? "dependencies and install scripts are not supported"
            : "unknown field",
        );
      }
    }
  };

  const text = (value: unknown, path: string, min: number, max: number) => {
    if (typeof value !== "string") return fail(path, "must be a string");
    const length = [...value.trim()].length;
    if (length < min || length > max) {
      fail(path, `must be ${min}-${max} characters`);
    }
    // eslint-disable-next-line no-control-regex -- refusing control characters is the point
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f‪-‮⁦-⁩]/.test(value)) {
      fail(path, "contains control or direction-override characters");
    }
  };

  const localText = (
    value: unknown,
    path: string,
    max: number = LIMITS.textShort,
  ) => {
    if (typeof value === "string") return text(value, path, 1, max);
    if (!isObject(value)) return fail(path, "must be a string or a locale map");
    const entries = Object.entries(value);
    if (!entries.length) fail(path, "must not be empty");
    if (!("en" in value)) fail(path, "needs an `en` entry");
    for (const [locale, entry] of entries) {
      if (!LOCALE_RE.test(locale)) fail(`${path}.${locale}`, "bad locale");
      text(entry, `${path}.${locale}`, 1, max);
    }
  };

  const m = input;
  known(m, "", [
    "$schema",
    "manifest_version",
    "id",
    "name",
    "version",
    "description",
    "author",
    "category",
    "icon",
    "api_version",
    "min_app_version",
    "platforms",
    "entrypoint",
    "permissions",
    "contributes",
    "locales",
    "integrity",
  ]);

  if (m.manifest_version !== MANIFEST_VERSION) {
    fail("manifest_version", `must be ${MANIFEST_VERSION}`);
  }
  if (typeof m.id !== "string" || !ID_RE.test(m.id) || m.id.length > 64) {
    fail("id", "must look like `publisher.plugin-name` (lowercase, 2-5 parts)");
  } else if ((m.id.startsWith(OFFICIAL_PREFIX) || m.id.startsWith(OFFICIAL_PREFIX_LEGACY)) && !options.official) {
    fail("id", "the `zrzur.` prefix is reserved for official plugins");
  }
  text(m.name, "name", 2, 48);
  if (!options.official && reservedPluginName(m.name)) fail("name", "is reserved for official plugins");
  if (typeof m.version !== "string" || !parseVersion(m.version)) {
    fail("version", "must be MAJOR.MINOR.PATCH");
  }
  text(m.description, "description", 1, LIMITS.textLong);
  if (!isObject(m.author)) {
    fail("author", "must be an object");
  } else {
    known(m.author, "author", ["name", "url"]);
    text(m.author.name, "author.name", 1, 64);
    if (!options.official && reservedPluginName(m.author.name)) fail("author.name", "is reserved for official plugins");
    if (m.author.url !== undefined) {
      if (
        typeof m.author.url !== "string" ||
        !/^https:\/\/[^\s/$.?#].[^\s]{0,190}$/.test(m.author.url)
      ) {
        fail("author.url", "must be an https URL");
      }
    }
  }
  if (!CATEGORIES.includes(m.category as Category)) {
    fail("category", `must be one of ${CATEGORIES.join(", ")}`);
  }
  if (
    m.icon !== undefined &&
    (typeof m.icon !== "string" || !ICON_RE.test(m.icon))
  ) {
    fail("icon", "must be a Material Symbols name (no images or URLs)");
  }
  if (m.api_version !== PLUGIN_API_VERSION) {
    fail(
      "api_version",
      `this Zrzur supports plugin API ${PLUGIN_API_VERSION}`,
    );
  }
  if (
    typeof m.min_app_version !== "string" ||
    !parseVersion(m.min_app_version)
  ) {
    fail("min_app_version", "must be MAJOR.MINOR.PATCH");
  }

  if (
    !Array.isArray(m.platforms) ||
    !m.platforms.length ||
    m.platforms.some((p) => !PLATFORMS.includes(p as Platform)) ||
    new Set(m.platforms).size !== m.platforms.length
  ) {
    fail("platforms", `must list some of ${PLATFORMS.join(", ")}`);
  }

  // entrypoint
  let worker = false;
  if (!isObject(m.entrypoint)) {
    fail("entrypoint", "must be an object");
  } else if (m.entrypoint.type === "declarative") {
    known(m.entrypoint, "entrypoint", ["type"]);
  } else if (m.entrypoint.type === "worker") {
    worker = true;
    known(m.entrypoint, "entrypoint", ["type", "file"]);
    if (
      typeof m.entrypoint.file !== "string" ||
      !FILE_RE.test(m.entrypoint.file)
    ) {
      fail(
        "entrypoint.file",
        "must be a plain file name like `main.js` (no folders)",
      );
    }
  } else {
    fail("entrypoint.type", "must be `declarative` or `worker`");
  }

  // permissions
  const permissions = new Set<string>();
  if (!Array.isArray(m.permissions)) {
    fail("permissions", "must be a list");
  } else {
    m.permissions.forEach((permission, i) => {
      const path = `permissions[${i}]`;
      if (typeof permission !== "string") return fail(path, "must be a string");
      if (permissions.has(permission)) return fail(path, "listed twice");
      permissions.add(permission);
      if ((FORBIDDEN_PERMISSIONS as readonly string[]).includes(permission)) {
        return fail(path, `\`${permission}\` can never be granted to a plugin`);
      }
      const entry = PERMISSIONS[permission as Permission];
      if (!entry) return fail(path, `unknown permission \`${permission}\``);
      if (!entry.supported) {
        fail(
          path,
          `\`${permission}\` is not supported by this Zrzur version`,
        );
      }
    });
  }
  const needs = (permission: Permission, path: string) => {
    if (!permissions.has(permission)) {
      fail(path, `needs the \`${permission}\` permission`);
    }
  };

  // contributes
  const settingTypes = new Map<string, string>();
  const commandIds = new Set<string>();
  const panelIds = new Set<string>();
  const bindable = (
    value: unknown,
    path: string,
    type: string,
    check: (value: unknown) => boolean,
  ) => {
    if (typeof value === "string") {
      const binding = BINDING_RE.exec(value);
      if (binding) {
        const settingType = settingTypes.get(binding[1]);
        if (!settingType)
          return fail(path, `no setting called \`${binding[1]}\``);
        if (settingType !== type) {
          return fail(path, `setting \`${binding[1]}\` must be a ${type}`);
        }
        return;
      }
    }
    if (!check(value)) fail(path, `must be a ${type}`);
  };

  if (m.contributes !== undefined) {
    if (!isObject(m.contributes)) {
      fail("contributes", "must be an object");
    } else {
      const c = m.contributes;
      known(c, "contributes", [
        "theme",
        "accessibility",
        "notifications",
        "commands",
        "keybinds",
        "settings",
        "panels",
        "message_actions",
        "events",
      ]);

      // settings first: other sections may bind to them
      if (c.settings !== undefined) {
        needs("storage.settings", "contributes.settings");
        if (!Array.isArray(c.settings) || c.settings.length > LIMITS.settings) {
          fail(
            "contributes.settings",
            `must be a list of at most ${LIMITS.settings}`,
          );
        } else {
          c.settings.forEach((setting, i) => {
            const path = `contributes.settings[${i}]`;
            if (!isObject(setting)) return fail(path, "must be an object");
            if (
              typeof setting.key !== "string" ||
              !SETTING_KEY_RE.test(setting.key)
            ) {
              return fail(
                `${path}.key`,
                "must be lowercase letters, digits and _",
              );
            }
            if (settingTypes.has(setting.key))
              fail(`${path}.key`, "listed twice");
            localText(setting.title, `${path}.title`);
            if (setting.description !== undefined) {
              localText(
                setting.description,
                `${path}.description`,
                LIMITS.textLong,
              );
            }
            const common = ["key", "type", "title", "description", "default"];
            switch (setting.type) {
              case "boolean":
                known(setting, path, common);
                if (typeof setting.default !== "boolean") {
                  fail(`${path}.default`, "must be true or false");
                }
                break;
              case "text": {
                known(setting, path, [...common, "max_length"]);
                const max = setting.max_length ?? 200;
                if (
                  typeof max !== "number" ||
                  !Number.isInteger(max) ||
                  max < 1 ||
                  max > 500
                ) {
                  fail(`${path}.max_length`, "must be 1-500");
                }
                if (
                  typeof setting.default !== "string" ||
                  setting.default.length > Number(max)
                ) {
                  fail(`${path}.default`, "must be a string within max_length");
                }
                break;
              }
              case "number": {
                known(setting, path, [...common, "min", "max", "step"]);
                const { min, max, step } = setting;
                if (
                  typeof min !== "number" ||
                  typeof max !== "number" ||
                  !Number.isFinite(min) ||
                  !Number.isFinite(max) ||
                  min >= max
                ) {
                  fail(path, "needs finite min < max");
                } else if (
                  typeof setting.default !== "number" ||
                  setting.default < min ||
                  setting.default > max
                ) {
                  fail(`${path}.default`, "must be between min and max");
                }
                if (
                  step !== undefined &&
                  (typeof step !== "number" || step <= 0)
                ) {
                  fail(`${path}.step`, "must be positive");
                }
                break;
              }
              case "select": {
                known(setting, path, [...common, "options"]);
                if (
                  !Array.isArray(setting.options) ||
                  !setting.options.length ||
                  setting.options.length > 20
                ) {
                  fail(`${path}.options`, "must list 1-20 options");
                } else {
                  const values = new Set<string>();
                  setting.options.forEach((option, j) => {
                    const p = `${path}.options[${j}]`;
                    if (!isObject(option)) return fail(p, "must be an object");
                    known(option, p, ["value", "label"]);
                    if (
                      typeof option.value !== "string" ||
                      !SETTING_KEY_RE.test(option.value)
                    ) {
                      fail(`${p}.value`, "must be a short lowercase id");
                    } else values.add(option.value);
                    localText(option.label, `${p}.label`);
                  });
                  if (!values.has(setting.default as string)) {
                    fail(`${path}.default`, "must be one of the options");
                  }
                }
                break;
              }
              case "color":
                known(setting, path, common);
                if (
                  typeof setting.default !== "string" ||
                  !COLOR_RE.test(setting.default)
                ) {
                  fail(`${path}.default`, "must be #rrggbb");
                }
                break;
              case "time":
                known(setting, path, common);
                if (
                  typeof setting.default !== "string" ||
                  !TIME_RE.test(setting.default)
                ) {
                  fail(`${path}.default`, "must be HH:MM");
                }
                break;
              default:
                return fail(
                  `${path}.type`,
                  "must be boolean, text, number, select, color or time",
                );
            }
            settingTypes.set(setting.key, setting.type as string);
          });
        }
      }

      if (c.theme !== undefined) {
        needs("theme.colors", "contributes.theme");
        if (!isObject(c.theme) || !isObject(c.theme.colors)) {
          fail("contributes.theme", "needs a `colors` object");
        } else {
          known(c.theme, "contributes.theme", ["colors"]);
          const colors = c.theme.colors;
          if (!Object.keys(colors).length)
            fail("contributes.theme.colors", "is empty");
          for (const [token, value] of Object.entries(colors)) {
            const path = `contributes.theme.colors.${token}`;
            if (RESERVED_THEME_TOKENS.includes(token)) {
              fail(
                path,
                "warning and error colours can't be changed by plugins",
              );
              continue;
            }
            if (!(THEME_TOKENS as readonly string[]).includes(token)) {
              fail(path, "unknown colour token");
              continue;
            }
            bindable(
              value,
              path,
              "color",
              (v) => typeof v === "string" && COLOR_RE.test(v),
            );
          }
          for (const [fg, bg, min] of CONTRAST_PAIRS) {
            const a = colors[fg];
            const b = colors[bg];
            if (
              typeof a === "string" &&
              typeof b === "string" &&
              COLOR_RE.test(a) &&
              COLOR_RE.test(b) &&
              contrast(a, b) < min
            ) {
              fail(
                `contributes.theme.colors.${fg}`,
                `contrast with ${bg} is ${contrast(a, b).toFixed(2)}:1, needs ${min}:1`,
              );
            }
          }
        }
      }

      if (c.accessibility !== undefined) {
        needs("accessibility.display", "contributes.accessibility");
        if (!isObject(c.accessibility)) {
          fail("contributes.accessibility", "must be an object");
        } else {
          const a = c.accessibility;
          known(a, "contributes.accessibility", [
            "font_scale",
            "line_height",
            "letter_spacing",
            "underline_links",
            "reduce_motion",
            "focus_ring",
          ]);
          const range = (min: number, max: number) => (v: unknown) =>
            typeof v === "number" && v >= min && v <= max;
          const bool = (v: unknown) => typeof v === "boolean";
          if (a.font_scale !== undefined)
            bindable(
              a.font_scale,
              "contributes.accessibility.font_scale",
              "number",
              range(0.85, 1.5),
            );
          if (a.line_height !== undefined)
            bindable(
              a.line_height,
              "contributes.accessibility.line_height",
              "number",
              range(1.2, 2),
            );
          if (a.letter_spacing !== undefined)
            bindable(
              a.letter_spacing,
              "contributes.accessibility.letter_spacing",
              "number",
              range(0, 0.12),
            );
          for (const key of [
            "underline_links",
            "reduce_motion",
            "focus_ring",
          ] as const) {
            if (a[key] !== undefined)
              bindable(
                a[key],
                `contributes.accessibility.${key}`,
                "boolean",
                bool,
              );
          }
        }
      }

      if (c.notifications !== undefined) {
        needs("notifications.display", "contributes.notifications");
        if (!isObject(c.notifications)) {
          fail("contributes.notifications", "must be an object");
        } else {
          const n = c.notifications;
          known(n, "contributes.notifications", [
            "quiet_hours",
            "quiet_hours_enabled",
            "hide_previews",
            "mute_sound",
          ]);
          const time = (v: unknown) => typeof v === "string" && TIME_RE.test(v);
          const bool = (v: unknown) => typeof v === "boolean";
          if (n.quiet_hours !== undefined) {
            if (!isObject(n.quiet_hours)) {
              fail(
                "contributes.notifications.quiet_hours",
                "needs start and end",
              );
            } else {
              known(n.quiet_hours, "contributes.notifications.quiet_hours", [
                "start",
                "end",
              ]);
              bindable(
                n.quiet_hours.start,
                "contributes.notifications.quiet_hours.start",
                "time",
                time,
              );
              bindable(
                n.quiet_hours.end,
                "contributes.notifications.quiet_hours.end",
                "time",
                time,
              );
            }
          }
          for (const key of [
            "quiet_hours_enabled",
            "hide_previews",
            "mute_sound",
          ] as const) {
            if (n[key] !== undefined)
              bindable(
                n[key],
                `contributes.notifications.${key}`,
                "boolean",
                bool,
              );
          }
        }
      }

      if (c.panels !== undefined) {
        needs("ui.panels", "contributes.panels");
        if (!Array.isArray(c.panels) || c.panels.length > LIMITS.panels) {
          fail(
            "contributes.panels",
            `must be a list of at most ${LIMITS.panels}`,
          );
        } else {
          for (const panel of c.panels) {
            if (isObject(panel) && typeof panel.id === "string")
              panelIds.add(panel.id);
          }
        }
      }

      // commands before keybinds / panels so references can be checked
      if (c.commands !== undefined) {
        needs("ui.commands", "contributes.commands");
        if (!Array.isArray(c.commands) || c.commands.length > LIMITS.commands) {
          fail(
            "contributes.commands",
            `must be a list of at most ${LIMITS.commands}`,
          );
        } else {
          c.commands.forEach((command, i) => {
            const path = `contributes.commands[${i}]`;
            if (!isObject(command)) return fail(path, "must be an object");
            known(command, path, ["id", "title", "action"]);
            if (
              typeof command.id !== "string" ||
              !LOCAL_ID_RE.test(command.id)
            ) {
              return fail(`${path}.id`, "must be a short lowercase id");
            }
            if (commandIds.has(command.id)) fail(`${path}.id`, "listed twice");
            commandIds.add(command.id);
            localText(command.title, `${path}.title`);
            const action = command.action;
            const ap = `${path}.action`;
            if (!isObject(action)) return fail(ap, "must be an object");
            switch (action.type) {
              case "setting.toggle":
                known(action, ap, ["type", "key"]);
                needs("app.preferences", ap);
                if (
                  !(TOGGLEABLE_SETTINGS as readonly unknown[]).includes(
                    action.key,
                  )
                ) {
                  fail(
                    `${ap}.key`,
                    `must be one of ${TOGGLEABLE_SETTINGS.join(", ")}`,
                  );
                }
                break;
              case "theme.toggle":
                known(action, ap, ["type"]);
                if (!isObject(c.theme))
                  fail(ap, "the plugin has no theme to toggle");
                break;
              case "accessibility.toggle":
                known(action, ap, ["type"]);
                if (!isObject(c.accessibility))
                  fail(ap, "the plugin has no accessibility settings");
                break;
              case "panel.open":
                known(action, ap, ["type", "panel"]);
                if (!panelIds.has(action.panel as string))
                  fail(`${ap}.panel`, "no such panel");
                break;
              case "notify":
                known(action, ap, ["type", "text"]);
                needs("notifications.show", ap);
                localText(action.text, `${ap}.text`, 140);
                break;
              case "composer.insert":
                known(action, ap, ["type", "text"]);
                needs("composer.insert", ap);
                text(action.text, `${ap}.text`, 1, LIMITS.insertText);
                break;
              case "navigate":
                known(action, ap, ["type", "to"]);
                if (
                  !(NAVIGATE_TARGETS as readonly unknown[]).includes(action.to)
                ) {
                  fail(
                    `${ap}.to`,
                    `must be one of ${NAVIGATE_TARGETS.join(", ")}`,
                  );
                }
                break;
              case "worker":
                known(action, ap, ["type", "handler"]);
                if (!worker) fail(ap, "needs a worker entrypoint");
                if (
                  typeof action.handler !== "string" ||
                  !LOCAL_ID_RE.test(action.handler)
                ) {
                  fail(`${ap}.handler`, "must be a short lowercase id");
                }
                break;
              default:
                fail(`${ap}.type`, "unknown action");
            }
          });
        }
      }

      if (c.panels !== undefined && Array.isArray(c.panels)) {
        const ids = new Set<string>();
        c.panels.forEach((panel, i) => {
          const path = `contributes.panels[${i}]`;
          if (!isObject(panel)) return fail(path, "must be an object");
          known(panel, path, ["id", "title", "blocks"]);
          if (typeof panel.id !== "string" || !LOCAL_ID_RE.test(panel.id)) {
            fail(`${path}.id`, "must be a short lowercase id");
          } else if (ids.has(panel.id)) fail(`${path}.id`, "listed twice");
          else ids.add(panel.id);
          localText(panel.title, `${path}.title`);
          if (
            !Array.isArray(panel.blocks) ||
            panel.blocks.length > LIMITS.panelBlocks
          ) {
            return fail(
              `${path}.blocks`,
              `must be a list of at most ${LIMITS.panelBlocks}`,
            );
          }
          panel.blocks.forEach((block, j) => {
            const bp = `${path}.blocks[${j}]`;
            if (!isObject(block)) return fail(bp, "must be an object");
            switch (block.type) {
              case "heading":
              case "text":
                known(block, bp, ["type", "text"]);
                localText(
                  block.text,
                  `${bp}.text`,
                  block.type === "text" ? 600 : LIMITS.textShort,
                );
                break;
              case "divider":
                known(block, bp, ["type"]);
                break;
              case "button":
                known(block, bp, ["type", "label", "command"]);
                localText(block.label, `${bp}.label`);
                if (!commandIds.has(block.command as string))
                  fail(`${bp}.command`, "no such command");
                break;
              case "setting":
                known(block, bp, ["type", "key"]);
                if (!settingTypes.has(block.key as string))
                  fail(`${bp}.key`, "no such setting");
                break;
              default:
                fail(
                  `${bp}.type`,
                  "must be heading, text, divider, button or setting",
                );
            }
          });
        });
      }

      if (c.keybinds !== undefined) {
        needs("keybinds", "contributes.keybinds");
        if (!Array.isArray(c.keybinds) || c.keybinds.length > LIMITS.keybinds) {
          fail(
            "contributes.keybinds",
            `must be a list of at most ${LIMITS.keybinds}`,
          );
        } else {
          const seen = new Set<string>();
          c.keybinds.forEach((bind, i) => {
            const path = `contributes.keybinds[${i}]`;
            if (!isObject(bind)) return fail(path, "must be an object");
            known(bind, path, ["command", "keys"]);
            if (!commandIds.has(bind.command as string))
              fail(`${path}.command`, "no such command");
            if (typeof bind.keys !== "string" || !KEYS_RE.test(bind.keys)) {
              fail(
                `${path}.keys`,
                "must be Ctrl+Shift+X, Alt+Shift+X or Ctrl+Alt+X (X = A-Z or 0-9)",
              );
            } else if (RESERVED_KEYS.includes(bind.keys)) {
              fail(`${path}.keys`, "is used by the browser or Zrzur");
            } else if (seen.has(bind.keys))
              fail(`${path}.keys`, "listed twice");
            else seen.add(bind.keys);
          });
        }
      }

      if (c.message_actions !== undefined) {
        needs("context.message.selected", "contributes.message_actions");
        if (!worker)
          fail("contributes.message_actions", "needs a worker entrypoint");
        if (
          !Array.isArray(c.message_actions) ||
          c.message_actions.length > LIMITS.messageActions
        ) {
          fail(
            "contributes.message_actions",
            `must be a list of at most ${LIMITS.messageActions}`,
          );
        } else {
          c.message_actions.forEach((action, i) => {
            const path = `contributes.message_actions[${i}]`;
            if (!isObject(action)) return fail(path, "must be an object");
            known(action, path, ["id", "title", "handler"]);
            if (typeof action.id !== "string" || !LOCAL_ID_RE.test(action.id))
              fail(`${path}.id`, "bad id");
            if (
              typeof action.handler !== "string" ||
              !LOCAL_ID_RE.test(action.handler)
            )
              fail(`${path}.handler`, "bad id");
            localText(action.title, `${path}.title`);
          });
        }
      }

      if (c.events !== undefined) {
        if (!worker) fail("contributes.events", "needs a worker entrypoint");
        if (!Array.isArray(c.events)) {
          fail("contributes.events", "must be a list");
        } else {
          c.events.forEach((event, i) => {
            if (!PLUGIN_EVENTS.includes(event as PluginEvent)) {
              fail(`contributes.events[${i}]`, "unknown event");
            } else if (event === "channel.switch") {
              needs("context.channel", `contributes.events[${i}]`);
            }
          });
        }
      }
    }
  }

  // locales
  if (m.locales !== undefined) {
    if (
      !isObject(m.locales) ||
      Object.keys(m.locales).length > LIMITS.locales
    ) {
      fail("locales", `must map at most ${LIMITS.locales} locales`);
    } else {
      for (const [locale, entry] of Object.entries(m.locales)) {
        const path = `locales.${locale}`;
        if (!LOCALE_RE.test(locale)) fail(path, "bad locale");
        if (!isObject(entry)) {
          fail(path, "must be an object");
          continue;
        }
        known(entry, path, ["name", "description", "strings"]);
        if (entry.name !== undefined) text(entry.name, `${path}.name`, 2, 48);
        if (!options.official && reservedPluginName(entry.name)) fail(`${path}.name`, "is reserved for official plugins");
        if (entry.description !== undefined) {
          text(entry.description, `${path}.description`, 1, LIMITS.textLong);
        }
        if (entry.strings !== undefined) {
          if (
            !isObject(entry.strings) ||
            Object.keys(entry.strings).length > LIMITS.localeStrings
          ) {
            fail(
              `${path}.strings`,
              `must map at most ${LIMITS.localeStrings} strings`,
            );
          } else {
            for (const [key, value] of Object.entries(entry.strings)) {
              if (!SETTING_KEY_RE.test(key))
                fail(`${path}.strings.${key}`, "bad key");
              text(value, `${path}.strings.${key}`, 1, LIMITS.textLong);
            }
          }
        }
      }
    }
  }

  // integrity / code
  if (m.integrity !== undefined) {
    if (
      !isObject(m.integrity) ||
      typeof m.integrity.sha256 !== "string" ||
      !SHA256_RE.test(m.integrity.sha256)
    ) {
      fail("integrity.sha256", "must be a lowercase hex SHA-256");
    } else {
      known(m.integrity, "integrity", ["sha256"]);
    }
  }
  if (worker) {
    if (m.integrity === undefined)
      fail(
        "integrity",
        "worker plugins need integrity.sha256 (run `zrzur-plugin pack`)",
      );
    if (
      options.code !== undefined &&
      utf8Length(options.code) > LIMITS.codeBytes
    ) {
      fail("code", `code is larger than ${LIMITS.codeBytes} bytes`);
    }
  } else if (options.code !== undefined && options.code !== "") {
    fail("code", "declarative plugins can't include code");
  }

  if (issues.length) return { ok: false, issues };
  const manifest = input as unknown as Manifest;
  return { ok: true, manifest, risk: riskOf(manifest), issues: [] };
}

/** Pick the text for a locale (`ar-SY` → `ar` → `en` → first) */
export function localise(value: LocalText | undefined, locale: string): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  const base = locale.split("-")[0];
  return (
    value[locale] ?? value[base] ?? value.en ?? Object.values(value)[0] ?? ""
  );
}

/** SHA-256 of UTF-8 text as lowercase hex (WebCrypto; browsers and Node) */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Patterns the scanner looks for. `block` findings reject a package; the
 * rest are shown to reviewers. Heuristics only: this is not malware
 * detection and never replaces a human code review.
 */
export const SCAN_RULES: {
  id: string;
  pattern: RegExp;
  block: boolean;
  message: string;
}[] = [
  {
    id: "private-key",
    pattern: /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/,
    block: true,
    message: "contains a private key",
  },
  {
    id: "aws-key",
    pattern: /AKIA[0-9A-Z]{16}/,
    block: true,
    message: "contains an AWS access key",
  },
  {
    id: "github-token",
    pattern: /gh[pousr]_[A-Za-z0-9]{36}/,
    block: true,
    message: "contains a GitHub token",
  },
  {
    id: "slack-token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/,
    block: true,
    message: "contains a Slack token",
  },
  {
    id: "stripe-live",
    pattern: /sk_live_[0-9a-zA-Z]{16,}/,
    block: true,
    message: "contains a Stripe live key",
  },
  {
    id: "session-header",
    pattern: /x-session-token|x-bot-token/i,
    block: true,
    message: "references Zrzur auth headers",
  },
  {
    id: "eval",
    pattern: /\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(\s*["'`]/,
    block: false,
    message: "dynamic code evaluation (blocked by the sandbox CSP)",
  },
  {
    id: "network",
    pattern: /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|importScripts/,
    block: false,
    message: "network access (blocked by the sandbox CSP)",
  },
  {
    id: "storage",
    pattern: /localStorage|sessionStorage|indexedDB|document\.cookie/,
    block: false,
    message: "browser storage access (unavailable in the sandbox)",
  },
  {
    id: "prototype",
    pattern: /__proto__|constructor\s*\.\s*constructor|Object\.setPrototypeOf/,
    block: false,
    message: "prototype manipulation",
  },
  {
    id: "obfuscation",
    pattern: /[A-Za-z0-9+/]{400,}={0,2}|(\\x[0-9a-fA-F]{2}){20,}/,
    block: false,
    message: "long encoded blob (possible obfuscation)",
  },
];

export type ScanFinding = {
  rule: string;
  block: boolean;
  message: string;
  line: number;
};

/** Run the scanner over manifest text and code */
export function scanPackage(manifestText: string, code = ""): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const sources = [manifestText, code];
  for (const source of sources) {
    const lines = source.split("\n");
    for (const rule of SCAN_RULES) {
      const index = lines.findIndex((line) => rule.pattern.test(line));
      if (index !== -1) {
        findings.push({
          rule: rule.id,
          block: rule.block,
          message: rule.message,
          line: index + 1,
        });
      }
    }
  }
  return findings;
}
