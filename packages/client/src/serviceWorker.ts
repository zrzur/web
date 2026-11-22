/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  getCacheKeyForURL,
  precacheAndRoute,
} from "workbox-precaching";

import { pageHandlesPush } from "../components/client/notificationRules";

import {
  OFFLINE_CACHE,
  OFFLINE_HEADERS,
  OFFLINE_LANGUAGE_KEY,
  offlineLocale,
  offlinePage,
} from "./offlinePage";
import {
  IMAGE_CACHE,
  IMAGE_CACHE_LIMIT,
  RUNTIME_CACHE,
  fetchWithRetry,
  isAppNavigation,
  isRuntimeAsset,
  isRuntimeImage,
  overLimit,
} from "./runtimeAssets";
import {
  SHELL_CACHE_PREFIX,
  buildKey,
  openApp,
  staleShellCaches,
} from "./shellPage";

declare let self: ServiceWorkerGlobalScope;

interface ChannelPartial {
  channel_type: string;
  name?: string;
}

interface StoatPushNotification {
  title?: string;
  author?: string;
  body: string;
  icon?: string;
  channel?: ChannelPartial;
  url?: string;
  /** Usually the channel id */
  tag?: string;
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  // the app's language, for the "no connection" page (the only thing the
  // worker knows about the person: two letters, no account data)
  if (event.data && event.data.type === "LANGUAGE") {
    const locale = offlineLocale(event.data.locale);
    if (locale)
      event.waitUntil(
        caches
          .open(OFFLINE_CACHE)
          .then((cache) =>
            cache.put(OFFLINE_LANGUAGE_KEY, new Response(locale)),
          ),
      );
  }
});

/** The language the app last ran in, then the device's own */
async function offlineLanguages() {
  const device = self.navigator.languages ?? [];
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const saved = await (await cache.match(OFFLINE_LANGUAGE_KEY))?.text();
    return saved ? [saved, ...device] : device;
  } catch {
    return device;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (typeof event.notification.data === "string") {
    // only open pages of this app, whatever the push payload says
    let url: URL | undefined;
    try {
      url = new URL(event.notification.data, self.location.origin);
    } catch {
      return;
    }
    if (url.origin === self.location.origin)
      event.waitUntil(self.clients.openWindow(url.href));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.text();

  const notification: StoatPushNotification = JSON.parse(payload);

  if (!notification.title) {
    if (notification.channel) {
      if (notification.channel.channel_type === "DirectMessage") {
        notification.title = notification.author || "Zrzur";
      } else {
        notification.title = `${notification.author} in ${notification.channel.name}`;
      }
    } else {
      notification.title = "Zrzur";
    }
  }

  notification.url ||= self.registration.scope;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // an open, visible page shows its own notification (and none for
        // the channel being read): a push on top would be a second one
        if (pageHandlesPush(clients as WindowClient[])) return;
        return self.registration.showNotification(
          notification.title || "Zrzur",
          {
            icon: notification.icon,
            body: notification.body,
            data: notification.url,
            // one notification per channel: a newer one replaces it
            tag: notification.tag,
          },
        );
      }),
  );
});

// A new release waits until a page asks for it (the SKIP_WAITING message
// above, src/serviceWorkerInterface.ts): taking over at once reloaded every
// open page, also in the middle of a message or a call. A page opened after
// the release asks right away, a page opened before it shows "Update".
// Once active, the new worker controls the open pages without a reload.
// Only the shell is listed (scripts/precacheShell.mjs); the rest of the app is
// kept the first time it is used
// (scripts and styles only: the build tool adds the web manifest to the list
// by itself, and nothing else may be kept)
const SHELL_FILES = self.__WB_MANIFEST.filter((entry) =>
  /\.(js|css)$/.test(typeof entry === "string" ? entry : entry.url),
);

// The app's page of this build, for opening without a connection
// (src/shellPage.ts): one cache per build, named after the build's files
const SHELL_CACHE =
  SHELL_CACHE_PREFIX +
  buildKey(
    SHELL_FILES.map((entry) =>
      typeof entry === "string"
        ? entry
        : `${entry.url}?${entry.revision ?? ""}`,
    ),
  );
const SHELL_KEY = new URL("__shell", self.registration.scope).href;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // the kept pages of older builds: their files are gone from the precache
      caches
        .keys()
        .then((names) =>
          Promise.all(
            staleShellCaches(names, SHELL_CACHE).map((name) =>
              caches.delete(name),
            ),
          ),
        ),
    ]),
  );
});

cleanupOutdatedCaches();

precacheAndRoute(SHELL_FILES);

async function cachedAsset(
  request: Request,
  name = RUNTIME_CACHE,
  limit?: number,
) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;

  // tried again before the page hears of a failure: see fetchWithRetry
  const response = await fetchWithRetry((signal) =>
    fetch(request.clone(), { signal }),
  );
  if (response.ok) {
    await cache.put(request, response.clone());
    const stale = overLimit(await cache.keys(), limit);
    await Promise.all(stale.map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope).pathname;

  // Opening the app: the network first, always. Without an answer from it,
  // the page kept from the last open (the app then starts offline); with
  // nothing kept yet, a page that says so and asks again
  if (isAppNavigation(event.request, url, self.location.origin, scope)) {
    event.respondWith(
      openApp<Response>({
        ask: () => fetch(event.request),
        copy: (response) => response.clone(),
        store: {
          get: async () =>
            (await (await caches.open(SHELL_CACHE)).match(SHELL_KEY)) ??
            undefined,
          put: async (response) =>
            (await caches.open(SHELL_CACHE)).put(SHELL_KEY, response),
        },
        offline: async () =>
          new Response(offlinePage(await offlineLanguages()), {
            status: 503,
            headers: OFFLINE_HEADERS,
          }),
      }),
    );
    return;
  }

  // the app's own pictures, so a start without a connection has them
  if (isRuntimeImage(event.request, url, self.location.origin, scope)) {
    event.respondWith(
      cachedAsset(event.request, IMAGE_CACHE, IMAGE_CACHE_LIMIT),
    );
    return;
  }

  if (!isRuntimeAsset(url, self.location.origin, scope)) return;
  // the precache answers its own files
  if (getCacheKeyForURL(url.href)) return;
  event.respondWith(cachedAsset(event.request));
});
