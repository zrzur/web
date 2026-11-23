import type { Client } from "@zrzur/sdk/solid";

import {
  isSnapshot,
  latestPageOf,
  newest,
  reconcile,
  trimReady,
} from "./snapshot";
import {
  MESSAGES_PER_CHANNEL,
  Vault,
  destroyVault,
  indexedDbBackend,
} from "./vault";

type Packet = { type: string } & Record<string, unknown>;
type RawMessage = { _id: string; channel?: string };
type MessagePage = { messages: RawMessage[] } & Record<string, unknown>;

/** Where the id of the account whose data is on this device is remembered */
export const OFFLINE_OWNER_KEY = "zrzur:offline-owner";

/** Wait before a channel's new messages are written, to write them together */
const WRITE_DELAY_MS = 3_000;

/**
 * Reading without a connection, for one signed-in client:
 *
 * - keeps the state the gateway sends and the latest messages of the
 *   channels that are opened (encrypted, see `vault.ts`);
 * - answers a request for a channel's latest messages from what is kept when
 *   the network gives no answer;
 * - starts the client from the kept state (`restore`), and brings it in line
 *   with the real one when the gateway answers again.
 *
 * It reads and writes only what the client already receives. It never sees
 * the session token.
 */
export class OfflineData {
  #client: Client;
  #vault: Vault;
  /** The state a start was made from, until the gateway sent the real one */
  #startedFrom: Packet | undefined;
  #restoring = false;
  #waiting = new Map<string, RawMessage[]>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #detach: (() => void) | undefined;

  constructor(client: Client, vault: Vault) {
    this.#client = client;
    this.#vault = vault;
  }

  /** True while the kept state is being put into the client */
  get restoring() {
    return this.#restoring;
  }

  /** Start keeping what the client receives */
  attach() {
    const events = this.#client.events as unknown as {
      on(name: "event", listener: (event: Packet) => void): void;
      off?(name: "event", listener: (event: Packet) => void): void;
    };
    events.on("event", this.#onEvent);

    const api = this.#client.api as unknown as {
      get: (...args: unknown[]) => Promise<unknown>;
    };
    const get = api.get;
    const wrapped = async (...args: unknown[]) => {
      const [path, query] = args as [unknown, Record<string, unknown>?];
      const channel =
        typeof path === "string" ? latestPageOf(path, query) : undefined;
      if (!channel) return get.apply(api, args);
      try {
        const answer = await get.apply(api, args);
        void this.#keepPage(channel, answer);
        return answer;
      } catch (error) {
        // the server answered with an error: that is the answer
        if (typeof (error as { type?: unknown } | null)?.type === "string")
          throw error;
        const kept = await this.#vault
          .loadMessages<MessagePage>(channel)
          .catch(() => undefined);
        if (!kept) throw error;
        return query?.include_users ? kept : kept.messages;
      }
    };
    api.get = wrapped;

    this.#detach = () => {
      events.off?.("event", this.#onEvent);
      if (api.get === wrapped) api.get = get;
      if (this.#timer) clearTimeout(this.#timer);
    };
  }

  /** Keep a state the gateway sent before this was attached */
  keepState(ready: unknown) {
    const packet = ready as Packet | undefined;
    if (packet?.type !== "Ready") return;
    void this.#vault.saveSnapshot(trimReady(packet)).catch(() => undefined);
  }

  /** Stop, and forget what was about to be written */
  detach() {
    this.#detach?.();
    this.#detach = undefined;
    this.#waiting.clear();
  }

  #onEvent = (event: Packet) => {
    if (event.type === "Ready") {
      // the kept state itself, on its way into the client
      if (this.#restoring) return;
      const fresh = trimReady(event);
      const kept = this.#startedFrom;
      this.#startedFrom = undefined;
      if (kept) {
        const emit = (
          this.#client.events as unknown as {
            emit(name: "event", event: Packet): unknown;
          }
        ).emit.bind(this.#client.events);
        for (const change of reconcile(kept, fresh)) emit("event", change);
      }
      void this.#vault.saveSnapshot(fresh).catch(() => undefined);
    } else if (event.type === "Message") {
      const message = event as unknown as RawMessage;
      if (typeof message.channel !== "string") return;
      const list = this.#waiting.get(message.channel) ?? [];
      // a copy: the client goes on changing the event it was given
      list.push({ ...message });
      this.#waiting.set(message.channel, list);
      this.#timer ??= setTimeout(() => {
        this.#timer = undefined;
        void this.#writeWaiting();
      }, WRITE_DELAY_MS);
    }
  };

  /** Keep a channel's latest page as the API answered it */
  async #keepPage(channel: string, answer: unknown) {
    try {
      const page: MessagePage | undefined = Array.isArray(answer)
        ? { messages: answer as RawMessage[] }
        : answer && Array.isArray((answer as MessagePage).messages)
          ? (answer as MessagePage)
          : undefined;
      if (!page) return;
      await this.#vault.saveMessages(channel, {
        ...page,
        messages: newest(page.messages, MESSAGES_PER_CHANNEL),
      });
    } catch {
      // the device is full or refuses storage: reading online is unaffected
    }
  }

  /** Add new messages to the channels that are already kept */
  async #writeWaiting() {
    const waiting = [...this.#waiting];
    this.#waiting.clear();
    for (const [channel, messages] of waiting) {
      try {
        const kept = await this.#vault.loadMessages<MessagePage>(channel);
        // a channel that was never opened is not kept
        if (!kept) continue;
        await this.#vault.saveMessages(channel, {
          ...kept,
          messages: newest(
            [...kept.messages, ...messages],
            MESSAGES_PER_CHANNEL,
          ),
        });
      } catch {
        // see #keepPage
      }
    }
  }

  /**
   * Put the kept state into the client, as the gateway's own would be.
   * @param proceed Asked once the kept state has been read: false leaves
   *   the client as it is (the server answered in the meantime)
   * @returns Whether it was put in
   */
  async restore(proceed?: () => boolean): Promise<boolean> {
    const kept = await this.#vault
      .loadSnapshot<Packet>()
      .catch(() => undefined);
    if (!isSnapshot(kept)) return false;
    if (proceed && !proceed()) return false;
    this.#restoring = true;
    try {
      (
        this.#client.events as unknown as {
          emit(name: "event", event: Packet): unknown;
        }
      ).emit("event", kept);
    } finally {
      this.#restoring = false;
    }
    this.#startedFrom = kept;
    return true;
  }
}

/** Offline data for an account on this device, or nothing where it cannot be kept */
export function offlineDataFor(
  client: Client,
  userId: string,
): OfflineData | undefined {
  if (
    typeof indexedDB === "undefined" ||
    typeof crypto === "undefined" ||
    !crypto.subtle
  )
    return undefined;
  claimDevice(userId);
  const data = new OfflineData(client, new Vault(indexedDbBackend(userId)));
  data.attach();
  return data;
}

/**
 * Only one account's data lives on a device: signing in as someone else
 * removes what the account before kept.
 */
function claimDevice(userId: string) {
  try {
    const before = localStorage.getItem(OFFLINE_OWNER_KEY);
    if (before && before !== userId) void destroyVault(before);
    localStorage.setItem(OFFLINE_OWNER_KEY, userId);
  } catch {
    // storage blocked: each account still has a store of its own
  }
}

/** Remove everything an account kept on this device (logout, session ended) */
export async function forgetOfflineData(userId: string | undefined) {
  if (!userId) return;
  try {
    if (localStorage.getItem(OFFLINE_OWNER_KEY) === userId)
      localStorage.removeItem(OFFLINE_OWNER_KEY);
  } catch {
    // see claimDevice
  }
  await destroyVault(userId).catch(() => undefined);
}
