/**
 * The API lives on its own host (api.zrzur.com). Its connection (name
 * lookup, TCP and TLS: three round trips, about half a second on a phone)
 * was only opened when the app's code had started and asked for the server
 * settings. The page now opens it while the code still downloads.
 * Requests to the API carry no cookies, so the hint is anonymous
 * (`crossorigin`), or the browser would not use the connection for them.
 */

/**
 * The origin to connect to early, if the API is on another host
 * @param {string | undefined} apiUrl VITE_API_URL
 * @param {string | undefined} host VITE_HOST (the app's own host)
 * @returns {string | undefined}
 */
export function preconnectOrigin(apiUrl, host) {
  if (!apiUrl) return undefined;
  let api;
  try {
    api = new URL(apiUrl);
  } catch {
    // a relative API address is the app's own host: already connected
    return undefined;
  }
  if (api.protocol !== "https:" && api.protocol !== "http:") return undefined;
  if (host && api.host === host) return undefined;
  return api.origin;
}

/**
 * Vite plugin: a preconnect link for the API, first in the page's head
 * @param {{ apiUrl?: string, host?: string }} [options]
 */
export function preconnectApi(options = {}) {
  const apiUrl = options.apiUrl ?? process.env.VITE_API_URL;
  const host = options.host ?? process.env.VITE_HOST;
  return {
    name: "zrzur-preconnect-api",
    transformIndexHtml() {
      const origin = preconnectOrigin(apiUrl, host);
      if (!origin) return [];
      return [
        {
          tag: "link",
          attrs: { rel: "preconnect", href: origin, crossorigin: "" },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}
