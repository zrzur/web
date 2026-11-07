import { CONFIGURATION } from "@revolt/common";
import { desktopScheme } from "./desktopScheme";

/**
 * Where each public Zrzur site lives, for the shared header and footer and
 * for the way from a public page into the app. Production hosts come from
 * the build (VITE_HOST, VITE_DISCOVER_URL, VITE_DESIGNS_HOST); without them
 * (development) everything points into this app.
 */

/** The official website */
export const WEBSITE_URL = "https://zrzur.com";

const trim = (url: string) => url.replace(/\/+$/, "");

/**
 * The public report form (DSA Art. 16), for people without an account, with
 * what they report already filled in
 */
export function publicReportUrl(
  kind: "DiscoverServer" | "Bot" | "CommunityItem",
  location: string,
  language?: string,
) {
  const query = new URLSearchParams({ kind, location });
  const prefix = language === "ar" || language === "de" ? `/${language}` : "";
  return `${WEBSITE_URL}${prefix}/report?${query}`;
}

/** The chat app, for the way from a public site into it */
export function appUrl() {
  const host = CONFIGURATION.DEFAULT_HOST;
  // development: the site preview may run on another local origin than
  // the app (VITE_DEV_APP_URL), like the real sites do
  if (import.meta.env.DEV)
    return trim((import.meta.env.VITE_DEV_APP_URL as string | undefined) ?? "");
  if (!host) return "";
  // a local test host has no certificate: plain http there only
  const scheme = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http://" : "https://";
  return trim(`${/^https?:\/\//.test(host) ? "" : scheme}${host}`);
}

/** The Discover site, or Discover inside the app */
export function discoverUrl() {
  return CONFIGURATION.DISCOVER_URL
    ? trim(CONFIGURATION.DISCOVER_URL)
    : `${appUrl()}/discover`;
}

/** The Designs site, or Designs inside the app */
export function designsUrl() {
  return CONFIGURATION.DESIGNS_HOST
    ? `https://${CONFIGURATION.DESIGNS_HOST}`
    : `${appUrl()}/designs`;
}

/** Bot and API docs (inside the app until developers.zrzur.com opens) */
export function developersUrl() {
  return `${appUrl()}/developers`;
}

/**
 * A path in the app with the deep link the desktop app understands
 * (zrzur://<path>), for "Join" and "Use this design" on a public site
 */
export function appLinks(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return {
    web: `${appUrl()}${clean}`,
    desktop: `${desktopScheme(appUrl())}:/${clean}`,
  };
}

/** Languages a public page offers, by their own names (no flags) */
export const SITE_LANGUAGES = [
  { id: "ar", name: "العربية" },
  { id: "en", name: "English" },
  { id: "de", name: "Deutsch" },
] as const;

export type SiteLanguage = (typeof SITE_LANGUAGES)[number]["id"];

/** The `?hl=` language a shared link asks for, if it is one we offer */
export function linkLanguage(search: string): SiteLanguage | undefined {
  const value = new URLSearchParams(search).get("hl");
  return SITE_LANGUAGES.find((language) => language.id === value)?.id;
}
