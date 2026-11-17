import { describe, expect, it } from "vitest";

import { installWayFor } from "./installPrompt";
import { IOS_SCREENS, splashFile, splashMedia } from "./iosScreens";
import {
  DISMISS_MS,
  INSTALL_OFFER_KEY,
  readOffer,
  recordDismissed,
  recordVisit,
  shouldOffer,
} from "./offerRules";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const device = (userAgent: string, more = {}) => ({
  userAgent,
  maxTouchPoints: 5,
  standalone: false,
  ...more,
});

function store(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => void (data[key] = value),
  };
}

describe("how a device installs the app", () => {
  it("Android installs through the browser's own window, once it offers it", () => {
    expect(installWayFor(device(ANDROID), true)).toBe("prompt");
    expect(installWayFor(device(ANDROID), false)).toBeUndefined();
  });

  it("iPhone and iPad get the steps", () => {
    expect(installWayFor(device(IPHONE), false)).toBe("ios");
    expect(installWayFor(device(IPAD), false)).toBe("ios");
  });

  it("a Mac without a touch screen is not an iPad", () => {
    expect(
      installWayFor(device(IPAD, { maxTouchPoints: 0 }), false),
    ).toBeUndefined();
  });

  it("nothing inside the installed app", () => {
    expect(
      installWayFor(device(ANDROID, { standalone: true }), true),
    ).toBeUndefined();
    expect(
      installWayFor(device(IPHONE, { standalone: true }), false),
    ).toBeUndefined();
  });

  it("nothing on a computer: the desktop app is the offer there", () => {
    expect(
      installWayFor(device(WINDOWS, { maxTouchPoints: 0 }), true),
    ).toBeUndefined();
  });

  it("nothing in another app's browser view on iOS: it cannot add to the home screen", () => {
    expect(
      installWayFor(device(`${IPHONE} Instagram 300.0`), false),
    ).toBeUndefined();
  });
});

describe("when the install sheet shows by itself", () => {
  const now = 1_800_000_000_000;

  it("not on the first visit, from the second on", () => {
    const local = store();
    expect(shouldOffer(recordVisit(local, store()), now)).toBe(false);
    expect(shouldOffer(recordVisit(local, store()), now)).toBe(true);
  });

  it("counts a visit once per session", () => {
    const local = store();
    const session = store();
    recordVisit(local, session);
    recordVisit(local, session);
    expect(readOffer(local).visits).toBe(1);
  });

  it("stays away for 30 days after it was closed", () => {
    const local = store();
    recordVisit(local, store());
    recordVisit(local, store());
    recordDismissed(local, now);
    expect(shouldOffer(readOffer(local), now + DISMISS_MS - 1)).toBe(false);
    expect(shouldOffer(readOffer(local), now + DISMISS_MS)).toBe(true);
  });

  it("starts again from unreadable or missing storage", () => {
    expect(readOffer(store({ [INSTALL_OFFER_KEY]: "{oops" }))).toEqual({
      visits: 0,
    });
    expect(readOffer(undefined)).toEqual({ visits: 0 });
    // blocked storage never throws
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(recordVisit(blocked, blocked)).toEqual({ visits: 0 });
    expect(() => recordDismissed(blocked, now)).not.toThrow();
  });
});

describe("iOS launch images", () => {
  it("every screen has its own file and query", () => {
    const files = new Set(IOS_SCREENS.map(splashFile));
    const queries = new Set(IOS_SCREENS.map(splashMedia));
    expect(files.size).toBe(IOS_SCREENS.length);
    expect(queries.size).toBe(IOS_SCREENS.length);
  });

  it("names a file by its real pixels", () => {
    expect(splashFile({ width: 390, height: 844, ratio: 3 })).toBe(
      "1170x2532.png",
    );
  });
});
