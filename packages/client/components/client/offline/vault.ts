/**
 * What one account keeps on this device for reading without a connection:
 * the last state the gateway sent (servers, conversations, members) and the
 * most recent messages of the channels that were opened.
 *
 * - One store per account, named after the user id. Another account on the
 *   same device never opens it.
 * - Every record is encrypted (AES-GCM, 256 bit) under a key made on this
 *   device and kept as a non-extractable `CryptoKey`: the data is not
 *   readable in the browser's files, in a backup or in an export of the
 *   profile. It does not protect against script running on Zrzur's own
 *   address, and nothing in a browser can.
 * - No session, token or password is ever written here.
 * - Logging out destroys the store and its key (`destroyVault`).
 */

/** Most recent messages kept per channel */
export const MESSAGES_PER_CHANNEL = 50;

/** Channels whose messages are kept; the least recently opened go first */
export const CHANNELS_KEPT = 30;

/** Bump when the shape of what is stored changes: older data is dropped */
export const VAULT_VERSION = 1;

/** Where the records live. IndexedDB in the app, memory in tests. */
export interface VaultBackend {
  get(store: VaultStore, key: string): Promise<unknown>;
  put(store: VaultStore, key: string, value: unknown): Promise<void>;
  delete(store: VaultStore, key: string): Promise<void>;
  keys(store: VaultStore): Promise<string[]>;
  /** Remove everything, the key included */
  destroy(): Promise<void>;
}

export type VaultStore = "keys" | "snapshot" | "messages" | "meta";

interface Sealed {
  v: number;
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

interface ChannelRecord {
  /** When the channel's messages were last written, for the limit */
  at: number;
  payload: Sealed;
}

const KEY_ID = "content";
const SNAPSHOT_ID = "ready";

/** The name of an account's database */
export function vaultName(userId: string) {
  return `zrzur-offline-${userId}`;
}

export class Vault {
  #backend: VaultBackend;
  #crypto: SubtleCrypto;
  #random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
  #key: Promise<CryptoKey> | undefined;
  #now: () => number;

  constructor(
    backend: VaultBackend,
    options: {
      crypto?: Crypto;
      now?: () => number;
    } = {},
  ) {
    const source = options.crypto ?? globalThis.crypto;
    this.#backend = backend;
    this.#crypto = source.subtle;
    this.#random = (bytes) => source.getRandomValues(bytes);
    this.#now = options.now ?? (() => Date.now());
  }

  /** The account's key: made once, never leaves the device, never readable */
  #contentKey(): Promise<CryptoKey> {
    this.#key ??= (async () => {
      const stored = (await this.#backend.get("keys", KEY_ID)) as
        | CryptoKey
        | undefined;
      if (stored) return stored;
      const key = await this.#crypto.generateKey(
        { name: "AES-GCM", length: 256 },
        false, // not extractable
        ["encrypt", "decrypt"],
      );
      await this.#backend.put("keys", KEY_ID, key);
      return key;
    })();
    return this.#key;
  }

  async #seal(value: unknown): Promise<Sealed> {
    const iv = this.#random(new Uint8Array(new ArrayBuffer(12)));
    const data = await this.#crypto.encrypt(
      { name: "AES-GCM", iv },
      await this.#contentKey(),
      new TextEncoder().encode(JSON.stringify(value)),
    );
    return { v: VAULT_VERSION, iv, data };
  }

  async #open<T>(sealed: unknown): Promise<T | undefined> {
    const record = sealed as Sealed | undefined;
    if (!record || record.v !== VAULT_VERSION) return undefined;
    try {
      const plain = await this.#crypto.decrypt(
        { name: "AES-GCM", iv: record.iv },
        await this.#contentKey(),
        record.data,
      );
      return JSON.parse(new TextDecoder().decode(plain)) as T;
    } catch {
      // another key (the store was rebuilt) or damaged data: as if absent
      return undefined;
    }
  }

  /** Keep the state the gateway sent */
  async saveSnapshot(snapshot: unknown): Promise<void> {
    await this.#backend.put(
      "snapshot",
      SNAPSHOT_ID,
      await this.#seal(snapshot),
    );
  }

  /** The state kept at the last connection, if any */
  async loadSnapshot<T>(): Promise<T | undefined> {
    return this.#open<T>(await this.#backend.get("snapshot", SNAPSHOT_ID));
  }

  /** Keep a channel's recent messages, as the API answered them */
  async saveMessages(channelId: string, payload: unknown): Promise<void> {
    const record: ChannelRecord = {
      at: this.#now(),
      payload: await this.#seal(payload),
    };
    await this.#backend.put("messages", channelId, record);
    await this.#prune();
  }

  /** A channel's kept messages, if any */
  async loadMessages<T>(channelId: string): Promise<T | undefined> {
    const record = (await this.#backend.get("messages", channelId)) as
      | ChannelRecord
      | undefined;
    return record ? this.#open<T>(record.payload) : undefined;
  }

  /** Drop the channels opened longest ago, beyond the limit */
  async #prune() {
    const ids = await this.#backend.keys("messages");
    if (ids.length <= CHANNELS_KEPT) return;
    const dated = await Promise.all(
      ids.map(async (id) => ({
        id,
        at:
          (
            (await this.#backend.get("messages", id)) as
              | ChannelRecord
              | undefined
          )?.at ?? 0,
      })),
    );
    dated.sort((a, b) => a.at - b.at);
    for (const { id } of dated.slice(0, dated.length - CHANNELS_KEPT))
      await this.#backend.delete("messages", id);
  }

  /** Remove everything this account kept, and its key */
  async destroy(): Promise<void> {
    this.#key = undefined;
    await this.#backend.destroy();
  }
}

/** A backend in memory: tests, and browsers without IndexedDB (nothing is kept) */
export function memoryBackend(): VaultBackend & {
  dump(): Map<string, unknown>;
} {
  const records = new Map<string, unknown>();
  const id = (store: VaultStore, key: string) => `${store}/${key}`;
  return {
    get: async (store, key) => records.get(id(store, key)),
    put: async (store, key, value) => void records.set(id(store, key), value),
    delete: async (store, key) => void records.delete(id(store, key)),
    keys: async (store) =>
      [...records.keys()]
        .filter((key) => key.startsWith(`${store}/`))
        .map((key) => key.slice(store.length + 1)),
    destroy: async () => records.clear(),
    dump: () => records,
  };
}

const STORES: VaultStore[] = ["keys", "snapshot", "messages", "meta"];

function done<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The account's database in IndexedDB */
export function indexedDbBackend(
  userId: string,
  factory: IDBFactory = indexedDB,
): VaultBackend {
  const name = vaultName(userId);
  let opening: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, VAULT_VERSION);
      request.onupgradeneeded = () => {
        // a new version starts empty: what an older shape kept is dropped
        for (const store of [...request.result.objectStoreNames])
          request.result.deleteObjectStore(store);
        for (const store of STORES) request.result.createObjectStore(store);
      };
      request.onsuccess = () => {
        // another tab logging out must be able to delete the database
        request.result.onversionchange = () => {
          request.result.close();
          opening = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    }));
  const store = async (which: VaultStore, mode: IDBTransactionMode) =>
    (await open()).transaction(which, mode).objectStore(which);

  return {
    get: async (which, key) => done((await store(which, "readonly")).get(key)),
    put: async (which, key, value) =>
      void (await done((await store(which, "readwrite")).put(value, key))),
    delete: async (which, key) =>
      void (await done((await store(which, "readwrite")).delete(key))),
    keys: async (which) =>
      (await done((await store(which, "readonly")).getAllKeys())).map(String),
    destroy: async () => {
      const db = await opening?.catch(() => undefined);
      db?.close();
      opening = undefined;
      await new Promise<void>((resolve) => {
        const request = factory.deleteDatabase(name);
        request.onsuccess =
          request.onerror =
          request.onblocked =
            () => resolve();
      });
    },
  };
}

/** Remove an account's store without opening it (logout, account change) */
export function destroyVault(
  userId: string,
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<void> {
  if (!factory) return Promise.resolve();
  return indexedDbBackend(userId, factory).destroy();
}
