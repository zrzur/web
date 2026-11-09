import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { findThread } from "./threads";

type Fake = {
  id: string;
  parentId?: string;
  thread?: { starterMessageId?: string };
};

/** A channel list that counts how often it is read from start to end */
function fakeChannels(initial: Fake[]) {
  const [list, setList] = createSignal(initial);
  const reads = { count: 0 };
  return {
    reads,
    setList,
    collection: {
      *values() {
        reads.count++;
        yield* list();
      },
    },
  };
}

describe("thread under a message", () => {
  it("reads the channel list once for a whole page of messages", () => {
    const channels = fakeChannels([
      { id: "text" },
      ...Array.from({ length: 500 }, (_, i) => ({ id: `other-${i}` })),
      { id: "t1", parentId: "text", thread: { starterMessageId: "m7" } },
    ]);
    createRoot((dispose) => {
      const found = Array.from({ length: 50 }, (_, i) =>
        findThread(channels.collection as never, "text", `m${i}`),
      );
      expect(found.filter(Boolean).map((c) => (c as Fake).id)).toEqual(["t1"]);
      expect(channels.reads.count).toBe(1);
      dispose();
    });
  });

  it("matches only the thread of that channel and message, and sees new threads", () => {
    const channels = fakeChannels([
      { id: "t1", parentId: "other", thread: { starterMessageId: "m1" } },
    ]);
    createRoot((dispose) => {
      const thread = () =>
        findThread(channels.collection as never, "text", "m1") as
          | Fake
          | undefined;
      expect(thread()).toBeUndefined();
      channels.setList((list) => [
        ...list,
        { id: "t2", parentId: "text", thread: { starterMessageId: "m1" } },
      ]);
      expect(thread()?.id).toBe("t2");
      dispose();
    });
  });
});
