/**
 * Addresses of documentation pages. Pages and components write every link
 * as `/developers/docs/<page>#<anchor>`, the address inside the app; on the
 * standalone site (developers.zrzur.com) the same page lives at
 * `/<page>#<anchor>`, and the Developer Portal is a link into the app.
 */

const APP_DOCS = "/developers/docs";
const APP_PORTAL = "/developers";

export interface DocsPlace {
  /** "" on the standalone site, "/developers/docs" inside the app */
  base: string;
  /** origin of the app, for links from the site into it */
  appOrigin: string;
}

const afterPrefix = (href: string, prefix: string) =>
  href === prefix ||
  (href.startsWith(prefix) && /^[/?#]/.test(href.slice(prefix.length)))
    ? href.slice(prefix.length)
    : undefined;

/**
 * What follows the site's root for a page of the app's address: the
 * overview is the front page itself, so it has no name there
 */
function siteRest(page: string) {
  const rest = page.startsWith("/") ? page : `/${page}`;
  const front = afterPrefix(rest, "/overview");
  return front === undefined ? rest : `/${front.replace(/^\//, "")}`;
}

/** The address to put in a link, for where the documentation is shown */
export function resolveDocsHref(href: string, place: DocsPlace) {
  if (afterPrefix(href, APP_PORTAL) === undefined) return href;
  const page = afterPrefix(href, APP_DOCS);
  if (page !== undefined) {
    if (place.base === APP_DOCS) return href;
    return `${place.base}${siteRest(page)}`;
  }
  // "My applications" and an application's page: only in the app
  if (place.base !== APP_DOCS && !/\.[a-z0-9]+$/i.test(href.split(/[?#]/)[0]))
    return `${place.appOrigin}${href}`;
  return href;
}

/**
 * A documentation link shown inside the app: the standalone site when
 * there is one (it opens beside the app), the in-app page otherwise
 */
export function docsLinkFromApp(href: string, docsUrl: string | undefined) {
  const page = afterPrefix(href, APP_DOCS);
  if (!docsUrl || page === undefined) return { href, external: false };
  return {
    href: `${docsUrl.replace(/\/+$/, "")}${siteRest(page)}`,
    external: true,
  };
}

/** The page a path shows; undefined for the front page */
export function pageOfPath(pathname: string, base: string) {
  if (!pathname.startsWith(base)) return undefined;
  return /^\/([^/]+)/.exec(pathname.slice(base.length))?.[1];
}

/**
 * Where an address of the in-app documentation lives on the standalone
 * site: same page, same anchor, same asked language
 */
export function siteAddress(
  docsUrl: string,
  location: { pathname: string; search: string; hash: string },
) {
  const page = pageOfPath(location.pathname, APP_DOCS);
  const language = new URLSearchParams(location.search).get("hl");
  return `${docsUrl.replace(/\/+$/, "")}/${page ?? ""}${
    language ? `?hl=${encodeURIComponent(language)}` : ""
  }${location.hash}`;
}
