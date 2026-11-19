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
