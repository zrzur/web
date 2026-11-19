import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A small stand-in for the browser's storage */
function fakeStorage(start: Record<string, string> = {}) {
  const data = new Map(Object.entries(start));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

/** The module reads storage once when it loads: load it fresh per test */
async function load(start?: Record<string, string>) {
  const storage = fakeStorage(start);
  vi.stubGlobal("localStorage", storage);
  vi.resetModules();
  return { lib: await import("./saveData"), storage };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("the Save data switch", () => {
  it("is off until someone turns it on", async () => {
    const { lib } = await load();
    expect(lib.saveData()).toBe(false);
  });

  it("is kept on this device and read back after a reload", async () => {
    const { lib, storage } = await load();
    lib.setSaveData(true);
    expect(lib.saveData()).toBe(true);
    expect(storage.data.get("zrzur:save-data")).toBe("1");

    // the next visit starts from what was stored
    const again = await load(Object.fromEntries(storage.data));
    expect(again.lib.saveData()).toBe(true);

    again.lib.setSaveData(false);
    expect(again.storage.data.get("zrzur:save-data")).toBe("0");
    expect(
      (await load(Object.fromEntries(again.storage.data))).lib.saveData(),
    ).toBe(false);
  });

  it("still works for the visit when storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    vi.resetModules();
    const lib = await import("./saveData");
    expect(lib.saveData()).toBe(false);
    lib.setSaveData(true);
    expect(lib.saveData()).toBe(true);
  });

  it("ignores anything else that was stored under its name", async () => {
    expect((await load({ "zrzur:save-data": "yes" })).lib.saveData()).toBe(
      false,
    );
    expect((await load({ "zrzur:save-data": "0" })).lib.saveData()).toBe(false);
  });
});

describe("offering the mode", () => {
  it("is suggested by the device's data saver or a 2G line, by nothing else", async () => {
    const { lib } = await load();
    expect(lib.connectionAsksToSave(undefined)).toBe(false);
    expect(lib.connectionAsksToSave({})).toBe(false);
    expect(lib.connectionAsksToSave({ effectiveType: "4g" })).toBe(false);
    expect(lib.connectionAsksToSave({ effectiveType: "3g" })).toBe(false);
    expect(
      lib.connectionAsksToSave({ saveData: true, effectiveType: "4g" }),
    ).toBe(true);
    expect(lib.connectionAsksToSave({ effectiveType: "2g" })).toBe(true);
    expect(lib.connectionAsksToSave({ effectiveType: "slow-2g" })).toBe(true);
  });

  it("is made once: not when the mode is on, not a second time", async () => {
    const { lib } = await load();
    const slow = { saveData: true };
    expect(
      lib.shouldOfferSaveData({ on: false, offered: false, connection: slow }),
    ).toBe(true);
    expect(
      lib.shouldOfferSaveData({ on: true, offered: false, connection: slow }),
    ).toBe(false);
    expect(
      lib.shouldOfferSaveData({ on: false, offered: true, connection: slow }),
    ).toBe(false);
    expect(
      lib.shouldOfferSaveData({
        on: false,
        offered: false,
        connection: { effectiveType: "4g" },
      }),
    ).toBe(false);
    expect(lib.shouldOfferSaveData({ on: false, offered: false })).toBe(false);
  });

  it("remembers that it was made, and never turns the mode on by itself", async () => {
    const { lib, storage } = await load();
    expect(lib.saveDataOffered()).toBe(false);
    lib.markSaveDataOffered();
    expect(lib.saveDataOffered()).toBe(true);
    expect(storage.data.get("zrzur:save-data-offered")).toBe("1");
    expect(lib.saveData()).toBe(false);
  });
});

describe("what waits for a tap", () => {
  it("nothing, while the mode is off", async () => {
    const { lib } = await load();
    expect(
      lib.holdsPicture(false, { size: 9_000_000, contentType: "image/jpeg" }),
    ).toBe(false);
    expect(
      lib.holdsPicture(false, { size: 900_000, contentType: "image/gif" }),
    ).toBe(false);
    expect(lib.holdsLinkMedia(false)).toBe(false);
    expect(lib.holdsRemoteVideo(false)).toBe(false);
    expect(lib.mediaPreload(false)).toBe("metadata");
    expect(lib.allowsAnimatedOriginal(false)).toBe(true);
    expect(lib.allowsLoadingAhead(false)).toBe(true);
  });

  it("a large picture, but not a small one", async () => {
    const { lib } = await load();
    const jpeg = (size?: number) => ({ size, contentType: "image/jpeg" });
    expect(lib.holdsPicture(true, jpeg(8_500_000))).toBe(true);
    expect(lib.holdsPicture(true, jpeg(lib.SMALL_PICTURE_BYTES + 1))).toBe(
      true,
    );
    expect(lib.holdsPicture(true, jpeg(lib.SMALL_PICTURE_BYTES))).toBe(false);
    expect(lib.holdsPicture(true, jpeg(60_000))).toBe(false);
  });

  it("a picture whose size is not known", async () => {
    const { lib } = await load();
    expect(lib.holdsPicture(true, { contentType: "image/png" })).toBe(true);
  });

  it("every GIF and animated picture, however small", async () => {
    const { lib } = await load();
    expect(
      lib.holdsPicture(true, { size: 20_000, contentType: "image/gif" }),
    ).toBe(true);
    expect(
      lib.holdsPicture(true, { size: 20_000, contentType: "image/apng" }),
    ).toBe(true);
    expect(
      lib.holdsPicture(true, {
        size: 20_000,
        contentType: "image/webp",
        metadata: { type: "Image", animated: true },
      }),
    ).toBe(true);
    expect(
      lib.holdsPicture(true, {
        size: 20_000,
        contentType: "image/webp",
        metadata: { type: "Image", animated: false },
      }),
    ).toBe(false);
  });

  it("media of link previews, other people's cameras, and players until Play", async () => {
    const { lib } = await load();
    expect(lib.holdsLinkMedia(true)).toBe(true);
    expect(lib.holdsRemoteVideo(true)).toBe(true);
    expect(lib.mediaPreload(true)).toBe("none");
    expect(lib.allowsAnimatedOriginal(true)).toBe(false);
    expect(lib.allowsLoadingAhead(true)).toBe(false);
  });

  it("stays loaded after one tap, for that item only", async () => {
    const { lib } = await load();
    expect(lib.wasLoadedByTap("a")).toBe(false);
    lib.markLoadedByTap("a");
    expect(lib.wasLoadedByTap("a")).toBe(true);
    expect(lib.wasLoadedByTap("b")).toBe(false);
    expect(lib.wasLoadedByTap(undefined)).toBe(false);
    lib.markLoadedByTap(undefined);
    expect(lib.wasLoadedByTap(undefined)).toBe(false);
  });
});

describe("voice", () => {
  it("is sent at 24 kbps when saving, and never raised", async () => {
    const { lib } = await load();
    expect(lib.voiceBitrateWhenSaving(false, 64_000)).toBe(64_000);
    expect(lib.voiceBitrateWhenSaving(false, 256_000)).toBe(256_000);
    expect(lib.voiceBitrateWhenSaving(true, 64_000)).toBe(24_000);
    expect(lib.voiceBitrateWhenSaving(true, 256_000)).toBe(24_000);
    expect(lib.voiceBitrateWhenSaving(true, 16_000)).toBe(16_000);
  });
});

describe("sizes on a placeholder", () => {
  it("are short and say nothing when unknown", async () => {
    const { lib } = await load();
    expect(lib.shortSize(undefined)).toBeUndefined();
    expect(lib.shortSize(0)).toBeUndefined();
    expect(lib.shortSize(512)).toBe("512 B");
    expect(lib.shortSize(61_849)).toBe("62 KB");
    expect(lib.shortSize(2_857_360)).toBe("2.9 MB");
    expect(lib.shortSize(8_589_528)).toBe("8.6 MB");
    expect(lib.shortSize(25_400_000)).toBe("25 MB");
  });
});

describe("avatar, icon and banner addresses", () => {
  /** Shaped like the SDK's File: the preview, or the animated original */
  class FakeFile {
    createFileURL(forceAnimation?: boolean) {
      return `https://files.test/avatars/1${forceAnimation ? "/original" : ""}`;
    }
  }

  it("never ask for the animated original while saving", async () => {
    const { lib } = await load();
    const undo = lib.stillFileUrlsWhenSaving(FakeFile.prototype);
    const file = new FakeFile();
    expect(file.createFileURL(true)).toBe(
      "https://files.test/avatars/1/original",
    );
    lib.setSaveData(true);
    expect(file.createFileURL(true)).toBe("https://files.test/avatars/1");
    expect(file.createFileURL()).toBe("https://files.test/avatars/1");
    lib.setSaveData(false);
    expect(file.createFileURL(true)).toBe(
      "https://files.test/avatars/1/original",
    );
    undo();
    lib.setSaveData(true);
    expect(file.createFileURL(true)).toBe(
      "https://files.test/avatars/1/original",
    );
  });
});

describe("small previews", () => {
  const MEDIA = "https://files.test";

  it("are not assumed: a media server has to say it makes them", async () => {
    const { lib } = await load();
    expect(lib.smallPreviews(MEDIA)).toBe(false);
    await lib.learnSmallPreviews(MEDIA, async () => ({
      autumn: "Hello, I am a file server!",
      version: "0.16.2",
    }));
    expect(lib.smallPreviews(MEDIA)).toBe(false);
  });

  it("are used once the media server's greeting says so, and remembered", async () => {
    const { lib, storage } = await load();
    const asked: string[] = [];
    await lib.learnSmallPreviews(MEDIA, async (url) => {
      asked.push(url);
      return { small_previews: true };
    });
    expect(asked).toEqual(["https://files.test/"]);
    expect(lib.smallPreviews(MEDIA)).toBe(true);
    expect(lib.smallPreviews("https://other.test")).toBe(false);
    expect(lib.smallPreviews(undefined)).toBe(false);
    // the next visit knows before it asks
    const again = await load(Object.fromEntries(storage.data));
    expect(again.lib.smallPreviews(MEDIA)).toBe(true);
  });

  it("ask the media server once per visit", async () => {
    const { lib } = await load();
    let times = 0;
    const get = async () => {
      times++;
      return { small_previews: true };
    };
    await lib.learnSmallPreviews(MEDIA, get);
    await lib.learnSmallPreviews(MEDIA, get);
    await lib.learnSmallPreviews(undefined, get);
    expect(times).toBe(1);
  });

  it("are forgotten when the server stops making them", async () => {
    const { lib, storage } = await load({ "zrzur:small-previews": MEDIA });
    expect(lib.smallPreviews(MEDIA)).toBe(true);
    await lib.learnSmallPreviews(MEDIA, async () => ({
      small_previews: false,
    }));
    expect(lib.smallPreviews(MEDIA)).toBe(false);
    expect(storage.data.get("zrzur:small-previews")).toBe("");
  });

  it("keep what was known when the server cannot be reached", async () => {
    const { lib } = await load({ "zrzur:small-previews": MEDIA });
    await lib.learnSmallPreviews(MEDIA, async () => {
      throw new Error("offline");
    });
    expect(lib.smallPreviews(MEDIA)).toBe(true);
  });

  it("are asked for with ?size=small on a plain preview address only", async () => {
    const { lib } = await load();
    expect(lib.smallPreviewUrl("https://files.test/attachments/Ab_c-1")).toBe(
      "https://files.test/attachments/Ab_c-1?size=small",
    );
    expect(lib.smallPreviewUrl("http://127.0.0.1:14814/emojis/01ABC")).toBe(
      "http://127.0.0.1:14814/emojis/01ABC?size=small",
    );
    expect(lib.smallPreviewUrl("https://cdn.test/files/avatars/x1")).toBe(
      "https://cdn.test/files/avatars/x1?size=small",
    );
    // the original, a named file and an address with a query stay as they are
    for (const url of [
      "https://files.test/attachments/abc/original",
      "https://files.test/attachments/abc/photo.jpg",
      "https://files.test/attachments/abc?size=small",
      "https://files.test/attachments/abc?x=1",
      "blob:https://app.test/1234",
    ])
      expect(lib.smallPreviewUrl(url)).toBe(url);
  });
});

describe("how an uploaded picture is shown", () => {
  const big = { size: 8_500_000, contentType: "image/jpeg" };
  const tiny = { size: 60_000, contentType: "image/jpeg" };
  const gif = { size: 400_000, contentType: "image/gif" };

  it("as always while the mode is off", async () => {
    const { lib } = await load();
    for (const small of [true, false])
      for (const file of [big, tiny, gif])
        expect(lib.pictureShown(false, small, file)).toBe("full");
  });

  it("as its small preview where the media server makes one, GIFs and small pictures too", async () => {
    const { lib } = await load();
    expect(lib.pictureShown(true, true, big)).toBe("small");
    expect(lib.pictureShown(true, true, tiny)).toBe("small");
    expect(lib.pictureShown(true, true, gif)).toBe("small");
  });

  it("held back whole where it does not: large pictures and GIFs, not small ones", async () => {
    const { lib } = await load();
    expect(lib.pictureShown(true, false, big)).toBe("held");
    expect(lib.pictureShown(true, false, gif)).toBe("held");
    expect(lib.pictureShown(true, false, tiny)).toBe("full");
  });
});

describe("avatars, icons and banners where small previews are made", () => {
  class Tagged {
    constructor(readonly tag: string) {}
    createFileURL(forceAnimation?: boolean) {
      return `https://files.test/${this.tag}/1${forceAnimation ? "/original" : ""}`;
    }
  }

  it("come small while saving, never as the animated original", async () => {
    const { lib } = await load();
    await lib.learnSmallPreviews("https://files.test", async () => ({
      small_previews: true,
    }));
    const undo = lib.stillFileUrlsWhenSaving(Tagged.prototype);
    lib.setSaveData(true);
    for (const tag of ["avatars", "icons", "banners"]) {
      expect(new Tagged(tag).createFileURL()).toBe(
        `https://files.test/${tag}/1?size=small`,
      );
      expect(new Tagged(tag).createFileURL(true)).toBe(
        `https://files.test/${tag}/1?size=small`,
      );
    }
    undo();
  });

  it("leave attachments to the message that shows them", async () => {
    const { lib } = await load();
    await lib.learnSmallPreviews("https://files.test", async () => ({
      small_previews: true,
    }));
    const undo = lib.stillFileUrlsWhenSaving(Tagged.prototype);
    lib.setSaveData(true);
    expect(new Tagged("attachments").createFileURL()).toBe(
      "https://files.test/attachments/1",
    );
    undo();
  });

  it("stay ordinary with the mode off, and on a server without small previews", async () => {
    const { lib } = await load();
    const undo = lib.stillFileUrlsWhenSaving(Tagged.prototype);
    lib.setSaveData(true);
    expect(new Tagged("avatars").createFileURL()).toBe(
      "https://files.test/avatars/1",
    );
    await lib.learnSmallPreviews("https://files.test", async () => ({
      small_previews: true,
    }));
    lib.setSaveData(false);
    expect(new Tagged("avatars").createFileURL()).toBe(
      "https://files.test/avatars/1",
    );
    expect(new Tagged("avatars").createFileURL(true)).toBe(
      "https://files.test/avatars/1/original",
    );
    undo();
  });
});

describe("the switch in more than one window", () => {
  /** A window and its page, enough to send the events a browser sends */
  function fakeWindow() {
    const handlers = new Map<string, Set<(event: unknown) => void>>();
    const on = (type: string, handler: (event: unknown) => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    };
    const off = (type: string, handler: (event: unknown) => void) =>
      handlers.get(type)?.delete(handler);
    const page = {
      visibilityState: "visible" as DocumentVisibilityState,
      addEventListener: on,
      removeEventListener: off,
    };
    return {
      target: { addEventListener: on, removeEventListener: off },
      page,
      send: (type: string, event: unknown = {}) =>
        [...(handlers.get(type) ?? [])].forEach((handler) => handler(event)),
      listeners: () =>
        [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
    };
  }

  it("follows a change another window made, both ways", async () => {
    const { lib, storage } = await load();
    const win = fakeWindow();
    const stop = lib.followSaveDataAcrossWindows(
      win.target as never,
      win.page as never,
    );
    expect(lib.saveData()).toBe(false);
    // the other window stores "1" and the browser tells this one
    storage.data.set("zrzur:save-data", "1");
    win.send("storage", { key: "zrzur:save-data", newValue: "1" });
    expect(lib.saveData()).toBe(true);
    storage.data.set("zrzur:save-data", "0");
    win.send("storage", { key: "zrzur:save-data", newValue: "0" });
    expect(lib.saveData()).toBe(false);
    stop();
    expect(win.listeners()).toBe(0);
  });

  it("ignores changes of other stored values", async () => {
    const { lib } = await load();
    const win = fakeWindow();
    lib.followSaveDataAcrossWindows(win.target as never, win.page as never);
    win.send("storage", { key: "zrzur:something-else", newValue: "1" });
    expect(lib.saveData()).toBe(false);
  });

  it("reads the stored value again when the window comes back to the front", async () => {
    const { lib, storage } = await load();
    const win = fakeWindow();
    lib.followSaveDataAcrossWindows(win.target as never, win.page as never);
    // changed while this window was frozen in the background: no event came
    storage.data.set("zrzur:save-data", "1");
    win.page.visibilityState = "hidden";
    win.send("visibilitychange");
    expect(lib.saveData()).toBe(false);
    win.page.visibilityState = "visible";
    win.send("visibilitychange");
    expect(lib.saveData()).toBe(true);
    storage.data.set("zrzur:save-data", "0");
    win.send("pageshow");
    expect(lib.saveData()).toBe(false);
    storage.data.set("zrzur:save-data", "1");
    win.send("focus");
    expect(lib.saveData()).toBe(true);
  });

  it("follows storage being cleared by another window", async () => {
    const { lib, storage } = await load({ "zrzur:save-data": "1" });
    const win = fakeWindow();
    lib.followSaveDataAcrossWindows(win.target as never, win.page as never);
    expect(lib.saveData()).toBe(true);
    storage.data.clear();
    win.send("storage", { key: null, newValue: null });
    expect(lib.saveData()).toBe(false);
  });

  it("never switches itself off when the browser refused to store the choice", async () => {
    let refuse = false;
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (refuse) throw new DOMException("full", "QuotaExceededError");
        data.set(key, value);
      },
    });
    vi.resetModules();
    const lib = await import("./saveData");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const win = fakeWindow();
    lib.followSaveDataAcrossWindows(win.target as never, win.page as never);
    refuse = true;
    lib.setSaveData(true);
    expect(warn).toHaveBeenCalledTimes(1);
    // the stored value is still the old "off": coming back to the front keeps "on"
    win.send("focus");
    win.send("visibilitychange");
    win.send("pageshow");
    expect(lib.saveData()).toBe(true);
    // a choice another window did store is newer, and is taken
    win.send("storage", { key: "zrzur:save-data", newValue: "0" });
    expect(lib.saveData()).toBe(false);
    warn.mockRestore();
  });

  it("stays on when it is turned on and the window comes back to the front", async () => {
    const { lib } = await load();
    const win = fakeWindow();
    lib.followSaveDataAcrossWindows(win.target as never, win.page as never);
    lib.setSaveData(true);
    win.send("focus");
    win.send("visibilitychange");
    win.send("pageshow");
    expect(lib.saveData()).toBe(true);
  });

  it("does nothing where there is no window", async () => {
    const { lib } = await load();
    expect(
      lib.followSaveDataAcrossWindows(undefined, undefined)(),
    ).toBeUndefined();
  });
});
