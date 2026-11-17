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
  RUNTIME_CACHE,
  isAppNavigation,
  isRuntimeAsset,
  overLimit,
} from "./runtimeAssets";

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
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();

// Only the shell is listed (scripts/precacheShell.mjs); the rest of the app is
// kept the first time it is used
// (scripts and styles only: the build tool adds the web manifest to the list
// by itself, and nothing else may be kept)
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) =>
    /\.(js|css)$/.test(typeof entry === "string" ? entry : entry.url),
  ),
);

async function cachedAsset(request: Request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const stale = overLimit(await cache.keys());
    await Promise.all(stale.map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope).pathname;

  // Opening the app: always from the network, never from a cache. Only when
  // the network cannot be reached at all, a page that says so and asks again
  if (isAppNavigation(event.request, url, self.location.origin, scope)) {
    event.respondWith(
      fetch(event.request).catch(
        async () =>
          new Response(offlinePage(await offlineLanguages()), {
            status: 503,
            headers: OFFLINE_HEADERS,
          }),
      ),
    );
    return;
  }

  if (!isRuntimeAsset(url, self.location.origin, scope)) return;
  // the precache answers its own files
  if (getCacheKeyForURL(url.href)) return;
  event.respondWith(cachedAsset(event.request));
});
