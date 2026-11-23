/** As stored in settings (`notifications:desktop`) */
type NotificationPermissionState =
  | "default"
  | "denied"
  | "allowed"
  | "unsupported";

/**
 * What the page needs from the browser to show a notification. Passed in,
 * so tests can stand in for a desktop browser or a phone.
 */
export type NotificationHost = {
  Notification?: {
    new (
      title: string,
      options?: NotificationOptions,
    ): {
      addEventListener(name: "click", listener: () => void): void;
    };
  };
  serviceWorker?: {
    getRegistration(scope?: string): Promise<
      | {
          showNotification(
            title: string,
            options?: NotificationOptions,
          ): Promise<void>;
        }
      | undefined
    >;
  };
  /** Scope of the app's service worker */
  scope?: string;
};

/** The browser the page runs in */
export function browserHost(): NotificationHost {
  return {
    Notification: "Notification" in window ? window.Notification : undefined,
    serviceWorker:
      "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
    scope: import.meta.env.BASE_URL ?? undefined,
  };
}

/**
 * Show a notification from the open page. Desktop browsers and the desktop
 * app build it in the page; Chrome on Android and home-screen apps on iOS
 * refuse that ("Illegal constructor") and only show one through the
 * service worker, which opens `path` when it is tapped.
 *
 * @returns How it was shown, or "none"
 */
export async function showPageNotification(
  host: NotificationHost,
  input: {
    title: string;
    options: NotificationOptions;
    /** Page of the message, opened on a tap */
    path: string;
    /** Tap on a notification built in the page */
    onClick: () => void;
  },
): Promise<"page" | "worker" | "none"> {
  if (host.Notification) {
    try {
      const notification = new host.Notification(input.title, input.options);
      notification.addEventListener("click", input.onClick);
      return "page";
    } catch {
      // refused in the page: the service worker may still show it
    }
  }

  try {
    const registration = await host.serviceWorker?.getRegistration(host.scope);
    if (!registration) return "none";
    await registration.showNotification(input.title, {
      ...input.options,
      data: input.path,
    });
    return "worker";
  } catch {
    return "none";
  }
}

/**
 * Whether this browser can show notifications, after the page tried to
 * build a test one. A refused constructor alone does not mean no: phones
 * show them through the service worker.
 */
export function canNotifyAfterProbe(
  probeThrew: boolean,
  hasServiceWorker: boolean,
): boolean {
  return !probeThrew || hasServiceWorker;
}

/**
 * Until 26.3, a phone whose browser refused the test notification was
 * stored as "unsupported" for good: no notifications, no message sound and
 * no switches in settings. Such a phone starts over from "default".
 */
export function repairedDesktopState(
  stored: NotificationPermissionState,
  browser: { hasNotification: boolean; hasServiceWorker: boolean },
): NotificationPermissionState {
  return stored === "unsupported" &&
    browser.hasNotification &&
    browser.hasServiceWorker
    ? "default"
    : stored;
}
