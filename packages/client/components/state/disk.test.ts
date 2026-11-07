import { beforeEach, describe, expect, it, vi } from "vitest";

import { diskGet, diskSet, resetDiskConnection } from "./disk";

describe("saved settings without IndexedDB", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
    });
    resetDiskConnection();
  });

  it("answers null for a key that was never saved", async () => {
    expect(await diskGet("missing")).toBeNull();
  });

  it("reads back what was saved", async () => {
    await diskSet("theme", { accent: "pink" });
    expect(await diskGet("theme")).toEqual({ accent: "pink" });
  });

  it("uses the localforage key prefix, so old data still reads", async () => {
    localStorage.setItem("localforage/old", '{"a":1}');
    expect(await diskGet("old")).toEqual({ a: 1 });
  });
});
