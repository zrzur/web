/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  getCacheKeyForURL,
  precacheAndRoute,
} from "workbox-precaching";

import { pageHandlesPush } from "../components/client/notificationRules";

import { RUNTIME_CACHE, isRuntimeAsset, overLimit } from "./runtimeAssets";

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
});

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

// A new release takes over at once: it installs without waiting for open tabs
// to close and controls them right away; registerSW (autoUpdate) then reloads
// the page onto the new files. Without this a tab could stay on an old release
// (old URLs included) until every Zrzur tab was closed.
self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();

// Only the shell is listed (scripts/precacheShell.mjs); the rest of the app is
// kept the first time it is used
precacheAndRoute(self.__WB_MANIFEST);

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
  if (!isRuntimeAsset(url, self.location.origin, scope)) return;
  // the precache answers its own files
  if (getCacheKeyForURL(url.href)) return;
  event.respondWith(cachedAsset(event.request));
});
