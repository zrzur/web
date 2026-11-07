import { describe, expect, it } from "vitest";

import { attachInteractions, interactionState } from "./store";

/** A client whose gateway events the test sends itself */
function fakeClient() {
  const listeners: ((event: unknown) => void)[] = [];
  const client = {
    events: {
      on: (_: string, fn: (event: unknown) => void) => listeners.push(fn),
    },
  };
  attachInteractions(client as unknown as Parameters<typeof attachInteractions>[0]);
  return (event: unknown) => listeners.forEach((fn) => fn(event));
}

const message = (id: string) => ({
  _id: id,
  interaction_id: "I",
  author: "BOT",
  channel_id: "CH",
  content: id,
});

describe("private bot answers", () => {
  it("appear, change and disappear when the bot deletes them", () => {
    const send = fakeClient();
    send({ type: "EphemeralMessageCreate", message: message("A") });
    send({ type: "EphemeralMessageCreate", message: message("B") });
    send({
      type: "EphemeralMessageUpdate",
      message: { ...message("A"), content: "changed" },
    });
    expect(interactionState.ephemeral.CH.map((m) => m.content)).toEqual([
      "changed",
      "B",
    ]);

    send({ type: "EphemeralMessageDelete", id: "A", channel_id: "CH" });
    expect(interactionState.ephemeral.CH.map((m) => m._id)).toEqual(["B"]);
  });
});
