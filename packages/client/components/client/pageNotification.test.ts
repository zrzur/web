import { describe, expect, it, vi } from "vitest";

import {
  type NotificationHost,
  canNotifyAfterProbe,
  repairedDesktopState,
  showPageNotification,
} from "./pageNotification";

/** Chrome on Android and iOS home-screen apps: the page may not build one */
class IllegalNotification {
  static permission: NotificationPermission = "granted";
  constructor() {
    throw new TypeError(
      "Failed to construct 'Notification': Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.",
    );
  }
}

/** Desktop browsers and Electron */
class WorkingNotification {
  static permission: NotificationPermission = "granted";
  static made: { title: string; options?: NotificationOptions }[] = [];
  listeners: Record<string, () => void> = {};
  constructor(
    public title: string,
    public options?: NotificationOptions,
  ) {
    WorkingNotification.made.push({ title, options });
  }
  addEventListener(name: string, fn: () => void) {
    this.listeners[name] = fn;
  }
}

function workerWith(show = vi.fn(async () => {})) {
  return {
    show,
    serviceWorker: {
      getRegistration: vi.fn(async () => ({ showNotification: show })),
    },
  };
}

const options = { body: "hello", tag: "C1", icon: "/a.png" };

describe("showPageNotification", () => {
  it("shows the page's own notification where the browser allows it", async () => {
    WorkingNotification.made = [];
    const worker = workerWith();
    const host = {
      Notification: WorkingNotification,
      serviceWorker: worker.serviceWorker,
    } as unknown as NotificationHost;
    const onClick = vi.fn();
    const how = await showPageNotification(host, {
      title: "@ali",
      options,
      path: "/channel/C1",
      onClick,
    });
    expect(how).toBe("page");
    expect(WorkingNotification.made).toHaveLength(1);
    expect(worker.show).not.toHaveBeenCalled();
  });

  it("falls back to the service worker when the constructor is refused (Android)", async () => {
    const worker = workerWith();
    const host = {
      Notification: IllegalNotification,
      serviceWorker: worker.serviceWorker,
    } as unknown as NotificationHost;
    const how = await showPageNotification(host, {
      title: "@ali",
      options,
      path: "/channel/C1",
      onClick: () => {},
    });
    expect(how).toBe("worker");
    expect(worker.show).toHaveBeenCalledWith("@ali", {
      ...options,
      // the worker opens this page when the notification is tapped
      data: "/channel/C1",
    });
  });

  it("reports nothing shown when neither way exists", async () => {
    const host = {
      Notification: IllegalNotification,
    } as unknown as NotificationHost;
    expect(
      await showPageNotification(host, {
        title: "@ali",
        options,
        path: "/channel/C1",
        onClick: () => {},
      }),
    ).toBe("none");
  });

  it("reports nothing shown when the worker is not registered", async () => {
    const host = {
      Notification: IllegalNotification,
      serviceWorker: { getRegistration: async () => undefined },
    } as unknown as NotificationHost;
    expect(
      await showPageNotification(host, {
        title: "@ali",
        options,
        path: "/channel/C1",
        onClick: () => {},
      }),
    ).toBe("none");
  });
});

describe("canNotifyAfterProbe", () => {
  it("is supported when the test notification works", () => {
    expect(canNotifyAfterProbe(false, false)).toBe(true);
  });
  it("is still supported through the worker when the constructor is refused", () => {
    expect(canNotifyAfterProbe(true, true)).toBe(true);
  });
  it("is unsupported only when there is no other way", () => {
    expect(canNotifyAfterProbe(true, false)).toBe(false);
  });
});

describe("repairedDesktopState", () => {
  const phone = { hasNotification: true, hasServiceWorker: true };
  it("gives phones marked unsupported by the old probe another chance", () => {
    expect(repairedDesktopState("unsupported", phone)).toBe("default");
  });
  it("keeps unsupported where notifications really do not exist", () => {
    expect(
      repairedDesktopState("unsupported", {
        hasNotification: false,
        hasServiceWorker: true,
      }),
    ).toBe("unsupported");
    expect(
      repairedDesktopState("unsupported", {
        hasNotification: true,
        hasServiceWorker: false,
      }),
    ).toBe("unsupported");
  });
  it("leaves every other choice alone", () => {
    for (const state of ["default", "allowed", "denied"] as const)
      expect(repairedDesktopState(state, phone)).toBe(state);
  });
});
