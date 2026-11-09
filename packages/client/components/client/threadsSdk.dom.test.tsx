import { createComputed, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { Client } from "@zrzur/sdk/solid";

import { findThread } from "./threads";

/** A real SDK client and channel list; nothing connects */
function setup() {
  const client = new Client({ baseURL: "http://127.0.0.1:1" });
  const channels = client.channels;
  const text = channels.getOrCreate("text", {
    _id: "text",
    channel_type: "TextChannel",
    server: "server",
    name: "general",
  } as never);
  const makeThread = (id: string, starter: string, parent = "text") =>
    channels.getOrCreate(id, {
      _id: id,
      channel_type: "TextChannel",
      server: "server",
      name: id,
      parent,
      thread: { owner: "user", starter_message: starter, message_count: 1 },
    } as never);
  return { client, channels, text, makeThread };
}

describe("thread index on the SDK's channel list", () => {
  it("follows threads being created, deleted, moved and changed", () => {
    const { channels, makeThread } = setup();
    createRoot((dispose) => {
      const thread = (message: string) =>
        findThread(channels, "text", message)?.id;

      expect(thread("m1")).toBeUndefined();

      // created
      makeThread("t1", "m1");
      expect(thread("m1")).toBe("t1");

      // the thread now belongs to another channel
      channels.updateUnderlyingObject("t1", "parentId", "other");
      expect(thread("m1")).toBeUndefined();
      expect(findThread(channels, "other", "m1")?.id).toBe("t1");
      channels.updateUnderlyingObject("t1", "parentId", "text");
      expect(thread("m1")).toBe("t1");

      // its thread state changes (another starter message)
      channels.updateUnderlyingObject("t1", "thread", {
        ...channels.getUnderlyingObject("t1").thread!,
        starterMessageId: "m2",
      });
      expect(thread("m1")).toBeUndefined();
      expect(thread("m2")).toBe("t1");

      // deleted
      channels.delete("t1");
      expect(thread("m2")).toBeUndefined();

      dispose();
    });
  });

  it("does not wake every message when no thread came, went or moved", () => {
    const { channels, makeThread } = setup();
    makeThread("t1", "m1");
    createRoot((dispose) => {
      let runs = 0;
      createComputed(() => {
        findThread(channels, "text", "m9");
        runs++;
      });
      expect(runs).toBe(1);
      channels.updateUnderlyingObject("t1", "thread", {
        ...channels.getUnderlyingObject("t1").thread!,
        messageCount: 2,
      });
      expect(runs).toBe(1);
      // a channel that is not a thread joins the list
      channels.getOrCreate("plain", {
        _id: "plain",
        channel_type: "TextChannel",
        server: "server",
        name: "plain",
      } as never);
      expect(runs).toBe(1);
      makeThread("t2", "m9");
      expect(runs).toBe(2);
      dispose();
    });
  });
});
