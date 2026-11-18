import { describe, expect, it } from "vitest";

import { CHANNELS_KEPT, Vault, memoryBackend, vaultName } from "./vault";

describe("what an account keeps for reading offline", () => {
  it("gives back the snapshot and the messages it was given", async () => {
    const vault = new Vault(memoryBackend());
    await vault.saveSnapshot({ type: "Ready", servers: [{ _id: "S1" }] });
    await vault.saveMessages("C1", {
      messages: [{ _id: "M1", content: "مرحبا" }],
    });
    expect(await vault.loadSnapshot()).toEqual({
      type: "Ready",
      servers: [{ _id: "S1" }],
    });
    expect(await vault.loadMessages("C1")).toEqual({
      messages: [{ _id: "M1", content: "مرحبا" }],
    });
    expect(await vault.loadMessages("C2")).toBeUndefined();
  });

  it("writes nothing readable: no text of a message is in the stored records", async () => {
    const backend = memoryBackend();
    const vault = new Vault(backend);
    const secret = "a private sentence nobody else should read";
    await vault.saveMessages("C1", { messages: [{ content: secret }] });
    await vault.saveSnapshot({ users: [{ username: "private-name" }] });

    const bytes = (value: unknown): string => {
      if (value instanceof ArrayBuffer)
        return new TextDecoder("latin1").decode(new Uint8Array(value));
      if (ArrayBuffer.isView(value))
        return new TextDecoder("latin1").decode(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        );
      if (value && typeof value === "object" && !(value instanceof CryptoKey))
        return Object.values(value as object)
          .map(bytes)
          .join("|");
      return typeof value === "string" ? value : "";
    };
    const stored = [...backend.dump().values()].map(bytes).join("|");
    expect(stored).not.toContain(secret);
    expect(stored).not.toContain("private-name");
    expect(stored.length).toBeGreaterThan(40);
  });

  it("keeps a key that cannot be read out", async () => {
    const backend = memoryBackend();
    await new Vault(backend).saveSnapshot({ ok: true });
    const key = backend.dump().get("keys/content") as CryptoKey;
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toBeTruthy();
  });

  it("reads again after a restart with the same key, and not with another", async () => {
    const backend = memoryBackend();
    await new Vault(backend).saveSnapshot({ servers: 3 });
    // a restart: a new object over the same records
    expect(await new Vault(backend).loadSnapshot()).toEqual({ servers: 3 });

    // the records of one account under the key of another: unreadable
    const other = memoryBackend();
    await new Vault(other).saveSnapshot({ servers: 9 });
    other.dump().set("snapshot/ready", backend.dump().get("snapshot/ready"));
    expect(await new Vault(other).loadSnapshot()).toBeUndefined();
  });

  it("keeps the channels opened last, up to the limit", async () => {
    let clock = 0;
    const backend = memoryBackend();
    const vault = new Vault(backend, { now: () => ++clock });
    for (let i = 0; i < CHANNELS_KEPT + 5; i++)
      await vault.saveMessages(`C${i}`, { i });
    const kept = await backend.keys("messages");
    expect(kept).toHaveLength(CHANNELS_KEPT);
    expect(kept).not.toContain("C0");
    expect(kept).toContain(`C${CHANNELS_KEPT + 4}`);
    // opened again: it is the newest now and stays
    await vault.saveMessages("C5", { again: true });
    await vault.saveMessages("new", {});
    expect(await backend.keys("messages")).toContain("C5");
  });

  it("leaves nothing after logout", async () => {
    const backend = memoryBackend();
    const vault = new Vault(backend);
    await vault.saveSnapshot({ a: 1 });
    await vault.saveMessages("C1", { b: 2 });
    await vault.destroy();
    expect(backend.dump().size).toBe(0);
    expect(await vault.loadSnapshot()).toBeUndefined();
    expect(await vault.loadMessages("C1")).toBeUndefined();
  });

  it("names the store after the account", () => {
    expect(vaultName("01ABC")).toBe("zrzur-offline-01ABC");
  });
});
