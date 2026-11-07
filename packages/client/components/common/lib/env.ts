/** Planned production host identity (set runtime via VITE_HOST when DNS/services are ready). */
export const ZRZUR_HOST = "app.zrzur.com";

/** Hosts of Zrzur's own web apps (stable and beta, one backend) */
export const ZRZUR_OFFICIAL_HOSTS: readonly string[] = [
  ZRZUR_HOST,
  "beta.zrzur.com",
];

/**
 * Forbidden upstream hosts (classification B protection / fail-closed blocklist).
 *
 * These strings MUST remain listed. They are NOT connection defaults and MUST NOT
 * be used as Zrzur API/WebSocket targets. Resolvers reject any VITE_* value whose
 * hostname matches these roots (or is a subdomain) so a misconfigured build cannot
 * silently talk to public Stoat/Revolt infrastructure.
 */
const UPSTREAM_HOSTS = [
  "stoat.chat",
  "api.stoat.chat",
  "beta.stoat.chat",
  "api.revolt.chat",
  "beta.revolt.chat",
  "revolt.chat",
] as const;

/** Forbidden upstream API URL shapes — same purpose as UPSTREAM_HOSTS (blocklist only). */
const UPSTREAM_API_URLS = [
  "https://api.revolt.chat",
  "https://api.stoat.chat",
  "https://stoat.chat/api",
  "https://beta.stoat.chat/api",
  "canary-api.stoat.chat",
] as const;

/**
 * Root domains that must never be used as configurable runtime service endpoints.
 * Checked via hostname equality or subdomain (`foo.stoat.chat`), after URL parsing.
 * Includes media/CDN and Gifbox roots so env overrides cannot point there either.
 */
const PROHIBITED_ROOT_DOMAINS = [
  "stoat.chat",
  "revolt.chat",
  "stoatusercontent.com",
  "gifbox.me",
] as const;

/** Local development defaults (fail closed away from upstream). */
const LOCAL_DEV_HOST = "localhost";
const LOCAL_DEV_API = "http://127.0.0.1:14702";

/**
 * Canonical upstream host string for comparisons only (deny-lists / remappers).
 * Not a runtime default for Zrzur connections.
 *
 * @deprecated Prefer ZRZUR_HOST for product identity; keep this for upstream detection.
 */
export const STOAT_HOST = "stoat.chat";

/**
 * App discovery payload shape. Protocol filename `.well-known/stoat` / `stoat.json`
 * is a compatibility-critical identifier (classification C) — do not rename.
 */
export interface AppConfig {
  api: string;
}

/**
 * Fetch env var by name, optionally only when in dev mode.
 * Also prevents compiler from optimizing out injected strings in Docker
 */
const getEnv = (name: string, devOnly?: boolean) =>
  !devOnly || import.meta.env.DEV
    ? (import.meta.env[name] as string)
    : undefined;

/** Strip DNS trailing-dot FQDN form and lowercase. */
function canonicalizeHostname(hostname: string): string {
  return hostname.replace(/\.$/, "").toLowerCase();
}

/**
 * Extract a hostname from a host string or absolute URL.
 * Handles schemes, ports, IPv4/IPv6, trailing dots, and case.
 * Returns null when the value cannot be parsed as a host/URL.
 */
export function parseHostname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    // Require "://" so host:port forms (e.g. localhost:14702) are not misread as schemes.
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withScheme);
    if (!url.hostname) return null;
    return canonicalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/** True when hostname is exactly a prohibited root or a subdomain of one. */
export function isProhibitedHostname(hostname: string): boolean {
  const h = canonicalizeHostname(hostname);
  if (!h || isLoopbackHostname(h)) return false;
  return PROHIBITED_ROOT_DOMAINS.some(
    (root) => h === root || h.endsWith(`.${root}`),
  );
}

/**
 * True when a host or absolute URL resolves to a prohibited upstream destination.
 * Unparseable non-empty values are treated as prohibited (fail closed) for
 * configurable service endpoints.
 */
export function isProhibitedEndpoint(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Preserve exact-list matches for documented blocklist entries (case-insensitive).
  const lower = trimmed.toLowerCase().replace(/\/$/, "");
  for (const listed of UPSTREAM_API_URLS) {
    if (lower === listed.toLowerCase().replace(/\/$/, "")) return true;
  }
  for (const listed of UPSTREAM_HOSTS) {
    if (lower === listed.toLowerCase()) return true;
  }

  const hostname = parseHostname(trimmed);
  if (!hostname) return true;
  return isProhibitedHostname(hostname);
}

/** @deprecated Prefer isProhibitedEndpoint — kept for call-site clarity in audits. */
export const isUpstreamHost = (host: string) => isProhibitedEndpoint(host);

/** @deprecated Prefer isProhibitedEndpoint */
export const isUpstreamAPI = (api: string) => isProhibitedEndpoint(api);

/**
 * Normalize only for recognizing legacy upstream hosts (deny-lists, old links).
 * Collapses Stoat/Revolt host variants to {@link STOAT_HOST}. Never remaps a
 * Zrzur/custom host onto Stoat production, and must not be used as a
 * connection target without {@link assertConnectionHostAllowed}.
 */
export const normalizeHost = (host: string) => {
  if (!host) return host;
  const hostname = parseHostname(host);
  if (!hostname) return host;
  if (
    hostname === "stoat.chat" ||
    hostname.endsWith(".stoat.chat") ||
    hostname === "revolt.chat" ||
    hostname.endsWith(".revolt.chat")
  ) {
    return STOAT_HOST;
  }
  return host;
};

export function assertConnectionHostAllowed(
  host: string,
  label = "instance host",
): void {
  if (!host?.trim()) return;
  if (isProhibitedEndpoint(host)) {
    throw new Error(
      `Zrzur: ${label} must not point at upstream Stoat/Revolt (${host}).`,
    );
  }
}

export function assertAllowedServiceUrl(
  url: string | undefined,
  label: string,
): string | undefined {
  if (url === undefined || url === "") return url;
  if (isProhibitedEndpoint(url)) {
    throw new Error(
      `Zrzur: ${label} must not point at upstream Stoat/Revolt (${url}).`,
    );
  }
  // Require parseable absolute URL for service endpoints (reject bare garbage).
  try {
    // Allow ws:/wss:/http:/https: and host:port forms via parseHostname
    if (!parseHostname(url)) {
      throw new Error("unparseable");
    }
  } catch {
    throw new Error(`Zrzur: ${label} is not a valid service URL (${url}).`);
  }
  return url;
}

export type HostEnv = {
  DEV: boolean;
  VITE_HOST?: string;
  VITE_DEV_HOST?: string;
};

export type ApiEnv = {
  DEV: boolean;
  VITE_API_URL?: string;
  VITE_DEV_API_URL?: string;
};

export function resolveDefaultHost(env: HostEnv): string {
  const raw = (env.DEV ? env.VITE_DEV_HOST : undefined) || env.VITE_HOST;
  // accept "app.zrzur.com" as well as "https://app.zrzur.com"
  const fromEnv = raw?.includes("://") ? new URL(raw).host : raw;
  if (fromEnv) {
    assertConnectionHostAllowed(fromEnv, "VITE_HOST/VITE_DEV_HOST");
    return fromEnv;
  }
  if (env.DEV) return LOCAL_DEV_HOST;
  throw new Error(
    "Zrzur: VITE_HOST is required for production builds. Missing config fails closed (no Stoat/Revolt fallback).",
  );
}

export function resolveDefaultApiUrl(env: ApiEnv): string {
  const fromEnv =
    (env.DEV ? env.VITE_DEV_API_URL : undefined) || env.VITE_API_URL;
  if (fromEnv) {
    assertAllowedServiceUrl(fromEnv, "VITE_API_URL/VITE_DEV_API_URL");
    return fromEnv;
  }
  if (env.DEV) return LOCAL_DEV_API;
  throw new Error(
    "Zrzur: VITE_API_URL is required for production builds. Missing config fails closed (no Stoat/Revolt fallback).",
  );
}

const DEFAULT_HOST = resolveDefaultHost({
  DEV: import.meta.env.DEV,
  VITE_HOST: getEnv("VITE_HOST"),
  VITE_DEV_HOST: getEnv("VITE_DEV_HOST", true),
});

const DEFAULT_API_URL = resolveDefaultApiUrl({
  DEV: import.meta.env.DEV,
  VITE_API_URL: getEnv("VITE_API_URL"),
  VITE_DEV_API_URL: getEnv("VITE_DEV_API_URL", true),
});

const DEV_WS_URL = assertAllowedServiceUrl(
  getEnv("VITE_DEV_WS_URL"),
  "VITE_DEV_WS_URL",
);
const DEV_MEDIA_URL = assertAllowedServiceUrl(
  getEnv("VITE_DEV_MEDIA_URL"),
  "VITE_DEV_MEDIA_URL",
);
const DEV_PROXY_URL = assertAllowedServiceUrl(
  getEnv("VITE_DEV_PROXY_URL"),
  "VITE_DEV_PROXY_URL",
);
const DEV_GIFBOX_URL = assertAllowedServiceUrl(
  getEnv("VITE_DEV_GIFBOX_URL"),
  "VITE_DEV_GIFBOX_URL",
);
const RNNOISE_WORKLET_CDN_URL = assertAllowedServiceUrl(
  getEnv("VITE_RNNOISE_WORKLET_CDN_URL"),
  "VITE_RNNOISE_WORKLET_CDN_URL",
);

/**
 * Optional Zrzur support / donation page (http(s) link shown on Home).
 * Unset hides the tile; upstream hosts are rejected like any service URL.
 */
export function resolveSupportUrl(value: string | undefined) {
  const url = assertAllowedServiceUrl(value?.trim(), "VITE_SUPPORT_URL");
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error(
      `Zrzur: VITE_SUPPORT_URL must be an http(s) link (${url}).`,
    );
  }
  return url || undefined;
}

/**
 * Optional invite code of the official Zrzur community server, opened
 * in-app through /invite/<code>. Unset hides the tile.
 */
export function resolveCommunityInvite(value: string | undefined) {
  const code = value?.trim();
  if (!code) return undefined;
  if (!/^[A-Za-z0-9]{3,64}$/.test(code)) {
    throw new Error(
      `Zrzur: VITE_COMMUNITY_INVITE must be an invite code, not a URL (${code}).`,
    );
  }
  return code;
}

/**
 * Optional public URL of the standalone Discover website (its own domain).
 * Unset hides "open on the web" / share links; there is no default.
 */
export function resolveDiscoverUrl(value: string | undefined) {
  const url = assertAllowedServiceUrl(value?.trim(), "VITE_DISCOVER_URL");
  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error(
      `Zrzur: VITE_DISCOVER_URL must be an http(s) link (${url}).`,
    );
  }
  return url ? url.replace(/\/+$/, "") : undefined;
}

/**
 * Optional host name of the standalone Designs site (e.g. designs.zrzur.com):
 * the same build, opened on that host, shows Designs only, without the chat
 * around it. Unset: Designs is only a page inside the app.
 */
export function resolveDesignsHost(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return undefined;
  const host = parseHostname(raw);
  // a bare host only: no path, query or fragment after it
  const rest = raw.replace(/^[a-z]+:\/\//i, "").replace(/\/$/, "");
  if (!host || /[/?#]/.test(rest)) {
    throw new Error(
      `Zrzur: VITE_DESIGNS_HOST must be a host name like designs.zrzur.com (${raw}).`,
    );
  }
  assertConnectionHostAllowed(host, "VITE_DESIGNS_HOST");
  return host;
}

/**
 * The settings service and bot id of Zrzur Assistant. Both unset hides its
 * settings page; hosts are checked like any service URL.
 */
export function resolveAssistant(
  url: string | undefined,
  botId: string | undefined,
) {
  const service = assertAllowedServiceUrl(url?.trim(), "VITE_ASSISTANT_URL");
  const id = botId?.trim();
  if (!service || !id) return undefined;
  if (!/^https?:\/\//i.test(service)) {
    throw new Error(
      `Zrzur: VITE_ASSISTANT_URL must be an http(s) link (${service}).`,
    );
  }
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) {
    throw new Error(`Zrzur: VITE_ASSISTANT_BOT_ID must be a bot id (${id}).`);
  }
  return { url: service.replace(/\/+$/, ""), botId: id };
}

const ASSISTANT = resolveAssistant(
  getEnv("VITE_ASSISTANT_URL"),
  getEnv("VITE_ASSISTANT_BOT_ID"),
);

const SUPPORT_URL = resolveSupportUrl(getEnv("VITE_SUPPORT_URL"));
const DISCOVER_URL = resolveDiscoverUrl(getEnv("VITE_DISCOVER_URL"));
const DESIGNS_HOST = resolveDesignsHost(getEnv("VITE_DESIGNS_HOST"));
const COMMUNITY_INVITE = resolveCommunityInvite(
  getEnv("VITE_COMMUNITY_INVITE"),
);

export default {
  /** Default instance (without the protocol) */
  DEFAULT_HOST,
  /** API URL of default instance */
  DEFAULT_API_URL,
  /** WS server override for development */
  DEV_WS_URL,
  /** Media server override for development */
  DEV_MEDIA_URL,
  /** Proxy server override for development */
  DEV_PROXY_URL,
  /** Gifbox server override for development — unset disables upstream gifbox.me */
  DEV_GIFBOX_URL,
  /**
   * RNNoise worklet CDN host location. Defaults to blank, which uses the url
   * provided by the livekit-rnnoise-processor package (jsDelivr, not Stoat/Revolt).
   */
  RNNOISE_WORKLET_CDN_URL,
  /** Zrzur Assistant's settings service (unset: page hidden) */
  ASSISTANT,
  /** Support / donation page for Home (unset: tile hidden) */
  SUPPORT_URL,
  /** Official community server invite code for Home (unset: tile hidden) */
  COMMUNITY_INVITE,
  /** Standalone Discover website (unset: web/share links hidden) */
  DISCOVER_URL,
  /** Host of the standalone Designs site (unset: Designs only in the app) */
  DESIGNS_HOST,
  /**
   * Session ID to set during development.
   */
  DEVELOPMENT_SESSION_ID: getEnv("VITE_SESSION_ID", true),
  /**
   * Token to set during development.
   */
  DEVELOPMENT_TOKEN: getEnv("VITE_TOKEN", true),
  /**
   * User ID to set during development.
   */
  DEVELOPMENT_USER_ID: getEnv("VITE_USER_ID", true),
};
