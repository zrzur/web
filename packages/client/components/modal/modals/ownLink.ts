import { isInviteCode } from "./inviteLink";

/**
 * One of Zrzur's own invite or bot links, as the app should show it: a server
 * card or a bot card, never a website preview. `path` is where it leads in
 * the app (a bot link keeps the permissions it asks for).
 */
export type OwnLink =
  | { kind: "invite"; code: string; path: string }
  | { kind: "bot"; id: string; permissions?: number; path: string };

export type OwnLinkOptions = {
  /** Short invite origin (VITE_INVITE_ORIGIN); zrzur.cc is always known */
  inviteOrigin?: string;
  /** Origins the app itself runs on (the instance, the open page) */
  appOrigins?: (string | undefined)[];
};

/** The short domain every Zrzur build knows, whatever it is configured with */
const SHORT_ORIGIN = "https://zrzur.cc";

/** Zrzur's own web apps, stable and beta */
const APP_ORIGINS = ["https://app.zrzur.com", "https://beta.zrzur.com"];

/** A bot id: a ULID (Crockford base 32, upper case) */
const RE_BOT_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Top-level pages of the app. When the app is its own short origin, these
 * are pages and not invite codes.
 */
const APP_PAGES = new Set([
  "app",
  "auth",
  "b",
  "bot",
  "channel",
  "check",
  "confirm-change",
  "connections",
  "create",
  "delete",
  "designs",
  "dev",
  "developers",
  "discover",
  "friends",
  "home",
  "i",
  "invite",
  "login",
  "oauth2",
  "pwa",
  "resend",
  "reset",
  "server",
  "settings",
  "verify",
  "you",
]);

type Base = { host: string; path: string[] };

/** Host without a leading `www.` or a trailing dot, lower case */
function plainHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/\.(?=:|$)/, "")
    .replace(/^www\./, "");
}

function baseOf(origin: string | undefined): Base | undefined {
  const raw = origin?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return {
      host: plainHost(url.host),
      path: url.pathname.split("/").filter(Boolean),
    };
  } catch {
    return undefined;
  }
}

function botLink(id: string, query: URLSearchParams): OwnLink | null {
  if (!RE_BOT_ID.test(id)) return null;
  const asked = query.get("permissions");
  const permissions = asked && /^\d+$/.test(asked) ? Number(asked) : 0;
  return Number.isSafeInteger(permissions) && permissions > 0
    ? {
        kind: "bot",
        id,
        permissions,
        path: `/bot/${id}?permissions=${permissions}`,
      }
    : { kind: "bot", id, path: `/bot/${id}` };
}

function inviteLink(code: string): OwnLink | null {
  return isInviteCode(code)
    ? { kind: "invite", code, path: `/invite/${code}` }
    : null;
}

/**
 * Whether `href` is one of our own invite or bot links, in any form we hand
 * out, and what it points at. Strict: only the hosts and paths that really
 * lead to an invite or a bot; anything else (lookalike hosts, extra path
 * segments, malformed codes) returns null and stays a normal link.
 *
 * - short origin (zrzur.cc, or VITE_INVITE_ORIGIN): `/{code}`, `/b/{botId}`
 * - app origins (app/beta.zrzur.com, the instance, the open page):
 *   `/invite/{code}`, `/bot/{botId}`, `/b/{botId}`, each optionally under
 *   `/i/{host}` for one of our hosts
 * - a bot link's `?permissions=` rides along
 */
export function parseOwnLink(
  href: string | URL,
  options: OwnLinkOptions = {},
): OwnLink | null {
  let url: URL;
  try {
    url = typeof href === "string" ? new URL(href) : href;
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = plainHost(url.host);
  const segments = url.pathname.split("/").filter(Boolean);
  // no empty segments (`//`); a single trailing slash is noted
  const clean = `/${segments.join("/")}`;
  if (url.pathname !== clean && url.pathname !== `${clean}/`) return null;
  const trailingSlash = url.pathname !== clean;

  const inviteOrigin =
    "inviteOrigin" in options
      ? options.inviteOrigin
      : (import.meta.env?.VITE_INVITE_ORIGIN as string | undefined);
  const appOrigins = [
    ...APP_ORIGINS,
    ...(options.appOrigins ??
      (typeof window !== "undefined" ? [window.location.origin] : [])),
  ];
  const appHosts = new Set(
    appOrigins.map((origin) => baseOf(origin)?.host).filter(Boolean),
  );

  // short form: {origin}/{code} and {origin}/b/{id}
  for (const base of [baseOf(SHORT_ORIGIN), baseOf(inviteOrigin)]) {
    if (!base || base.host !== host) continue;
    if (!base.path.every((segment, i) => segments[i] === segment)) continue;
    const rest = segments.slice(base.path.length);
    if (rest.length === 2 && rest[0] === "b") {
      const bot = botLink(rest[1], url.searchParams);
      if (bot) return bot;
    }
    if (
      rest.length === 1 &&
      !trailingSlash &&
      // the app as its own short origin: its pages are not codes
      !(appHosts.has(host) && APP_PAGES.has(rest[0].toLowerCase()))
    ) {
      const invite = inviteLink(rest[0]);
      if (invite) return invite;
    }
  }

  // app forms
  if (!appHosts.has(host)) return null;
  let rest = segments;
  if (rest[0] === "i") {
    const prefixed = rest[1] ? plainHost(rest[1]) : "";
    if (prefixed !== host && !appHosts.has(prefixed)) return null;
    rest = rest.slice(2);
  }
  if (rest.length !== 2) return null;
  if (rest[0] === "invite") return inviteLink(rest[1]);
  if (rest[0] === "bot" || rest[0] === "b") {
    return botLink(rest[1], url.searchParams);
  }
  return null;
}
