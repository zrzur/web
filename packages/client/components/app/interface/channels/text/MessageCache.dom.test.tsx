// The message cache keeps the last channels as they were and lets the
// messages of all others go (they used to stay for as long as the app ran).
import { render } from "solid-js/web";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/client", () => ({
  useClientLifecycle: () => ({ lifecycle: { state: () => 0 } }),
}));
vi.mock("@revolt/client/Controller", () => ({ State: { Connected: 1 } }));

import {
  KEPT_CHANNELS,
  MessageCache,
  PRUNE_ABOVE,
  PRUNE_EVERY,
  PRUNE_GRACE,
  useMessageCache,
} from "./MessageCache";

type Fake = { id: string; channelId: string };

function fakeClient() {
  const store = new Map<string, Fake>();
  return {
    store,
    addListener: () => undefined,
    removeListener: () => undefined,
    messages: {
      size: () => store.size,
      entries: () => store.entries(),
      delete: (id: string) => void store.delete(id),
    },
    /** Put `count` messages of a channel into the cache */
    load(channelId: string, count: number): Fake[] {
      const made: Fake[] = [];
      for (let i = 0; i < count; i++) {
        const message = { id: `${channelId}-${i}`, channelId };
        store.set(message.id, message);
        made.push(message);
      }
      return made;
    },
    count(channelId: string) {
      return [...store.values()].filter((m) => m.channelId === channelId)
        .length;
    },
  };
}

let dispose: (() => void) | undefined;
let cache: NonNullable<ReturnType<typeof useMessageCache>>;

function mount(client: ReturnType<typeof fakeClient>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  function Probe() {
    cache = useMessageCache()!;
    return null;
  }
  dispose = render(
    () => (
      <MessageCache client={client as never}>
        <Probe />
      </MessageCache>
    ),
    host,
  );
}

const channel = (id: string) => ({ id }) as never;
const state = (messages: Fake[]) => ({
  messages: messages as never,
  atStart: false,
  atEnd: true,
});
/** Enough passes for the grace time to run out */
const passTime = () => vi.advanceTimersByTime(PRUNE_GRACE + 2 * PRUNE_EVERY);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("MessageCache", () => {
  it("lets the messages of channels left long ago go, and keeps the open one", () => {
    const client = fakeClient();
    mount(client);
    client.load("open", PRUNE_ABOVE);
    client.load("gone", 300);
    cache.opened(channel("open"));

    vi.advanceTimersByTime(PRUNE_EVERY);
    // a first pass only notes what could go
    expect(client.count("gone")).toBe(300);

    passTime();
    expect(client.count("gone")).toBe(0);
    expect(client.count("open")).toBe(PRUNE_ABOVE);
  });

  it("keeps the channels the person left most recently, as they were", () => {
    const client = fakeClient();
    mount(client);
    client.load("filler", PRUNE_ABOVE);
    const names = Array.from({ length: KEPT_CHANNELS + 2 }, (_, i) => `c${i}`);
    for (const name of names)
      cache.manage(channel(name), state(client.load(name, 20)));

    passTime();
    // the two left first are gone, the rest come back as they were
    expect(client.count("c0")).toBe(0);
    expect(client.count("c1")).toBe(0);
    expect(cache.unmanage(channel("c0"))).toBeUndefined();
    for (const name of names.slice(2)) expect(client.count(name)).toBe(20);
    expect(cache.unmanage(channel("c2"))?.messages).toHaveLength(20);
  });

  it("keeps a message that is on screen somewhere else (search results)", () => {
    const client = fakeClient();
    mount(client);
    client.load("filler", PRUNE_ABOVE);
    const [shown] = client.load("searched", 5);
    const row = document.createElement("div");
    row.id = shown.id;
    document.body.appendChild(row);

    passTime();
    expect(client.count("searched")).toBe(1);
    expect(client.store.has(shown.id)).toBe(true);
  });

  it("stops when it is taken down", () => {
    const client = fakeClient();
    mount(client);
    client.load("filler", PRUNE_ABOVE + 50);
    dispose?.();
    dispose = undefined;
    passTime();
    expect(client.store.size).toBe(PRUNE_ABOVE + 50);
  });
});
