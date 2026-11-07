import { describe, expect, it } from "vitest";

import { stashPending, takePending } from "./pendingWrites";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("pending writes", () => {
  it("keeps a change and hands it back once", () => {
    const storage = memoryStorage();
    stashPending(storage, "voice", { pttKey: "KeyV" });
    expect(takePending(storage, "voice")).toEqual({ pttKey: "KeyV" });
    expect(takePending(storage, "voice")).toBeUndefined();
    expect(storage.data.size).toBe(0);
  });

  it("never stashes the sign-in store", () => {
    const storage = memoryStorage();
    stashPending(storage, "auth", { session: { token: "secret" } });
    expect(storage.data.size).toBe(0);
    expect(takePending(storage, "auth")).toBeUndefined();
  });

  it("ignores broken data and storage that throws", () => {
    const storage = memoryStorage();
    storage.setItem("zrzur.pending.voice", "{not json");
    expect(takePending(storage, "voice")).toBeUndefined();
    expect(storage.data.size).toBe(0);

    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => stashPending(throwing, "voice", {})).not.toThrow();
    expect(takePending(throwing, "voice")).toBeUndefined();
  });
});
