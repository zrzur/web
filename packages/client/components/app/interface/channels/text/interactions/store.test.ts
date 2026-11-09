import { describe, expect, it, vi } from "vitest";

import {
  AutocompleteTimeout,
  attachInteractions,
  commandsKey,
  interactionState,
  loadServerCommands,
  requestAutocomplete,
  useComponent,
} from "./store";

/** A client whose gateway events the test sends itself */
function fakeClient() {
  const listeners: ((event: unknown) => void)[] = [];
  const client = {
    events: {
      on: (_: string, fn: (event: unknown) => void) => listeners.push(fn),
    },
  };
  attachInteractions(
    client as unknown as Parameters<typeof attachInteractions>[0],
  );
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

describe("autocomplete", () => {
  const command = {
    _id: "CMD",
    application_id: "BOT",
    name: "play",
    type: "ChatInput",
    version: "1",
  } as Parameters<typeof requestAutocomplete>[2];
  const client = (id: string) =>
    ({
      api: { post: async () => ({ _id: id }) },
    }) as unknown as Parameters<typeof requestAutocomplete>[0];

  it("says the bot did not answer when no suggestions arrive in time", async () => {
    vi.useFakeTimers();
    try {
      const asked = requestAutocomplete(
        client("A1"),
        "CH",
        command,
        [],
        "song",
        new AbortController().signal,
      );
      const outcome = asked.then(
        () => "answered",
        (error) => (error instanceof AutocompleteTimeout ? "silent" : "other"),
      );
      await vi.advanceTimersByTimeAsync(5000);
      expect(await outcome).toBe("silent");
    } finally {
      vi.useRealTimers();
    }
  });

  it("an empty answer from the bot is no matches, not silence", async () => {
    const send = fakeClient();
    const asked = requestAutocomplete(
      client("A2"),
      "CH",
      command,
      [],
      "song",
      new AbortController().signal,
    );
    await new Promise((r) => setTimeout(r, 0));
    send({ type: "InteractionAutocompleteResult", id: "A2", choices: [] });
    expect(await asked).toEqual([]);
  });

  it("a newer keystroke cancels quietly", async () => {
    const controller = new AbortController();
    const asked = requestAutocomplete(
      client("A3"),
      "CH",
      command,
      [],
      "song",
      controller.signal,
    );
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    expect(await asked).toEqual([]);
  });
});

describe("a failed button or menu", () => {
  it("keeps its error at the component that was used", async () => {
    const failing = {
      api: {
        post: async () => {
          throw new Error("offline");
        },
      },
    } as unknown as Parameters<typeof useComponent>[0];
    await useComponent(failing, "CH", "MSG", "vote").catch(() => undefined);
    expect(interactionState.componentErrors["MSG:vote"]).toBe("Unknown");
    expect(interactionState.busy["MSG:vote"]).toBeUndefined();
    // the timeline does not show it a second time
    expect(
      Object.values(interactionState.pending).some(
        (entry) => entry.componentKey === "MSG:vote" && !entry.label,
      ),
    ).toBe(true);
  });
});

describe("where a channel's commands come from", () => {
  it("a server channel asks for that channel, so channel rules apply", () => {
    expect(
      commandsKey({ id: "CH", type: "TextChannel", serverId: "SRV" }),
    ).toBe("SRV#CH");
  });

  it("a thread or forum post uses the list of the channel it is in", () => {
    expect(
      commandsKey({
        id: "THREAD",
        type: "TextChannel",
        serverId: "SRV",
        parentId: "CH",
      }),
    ).toBe("SRV#CH");
  });

  it("a DM with a bot uses the bot's global commands; other DMs have none", () => {
    expect(
      commandsKey({
        id: "D",
        type: "DirectMessage",
        recipient: { id: "BOT", bot: { owner: "o" } },
      }),
    ).toBe("dm:BOT");
    expect(
      commandsKey({ id: "D", type: "DirectMessage", recipient: { id: "P" } }),
    ).toBeUndefined();
    expect(commandsKey({ id: "G", type: "Group" })).toBeUndefined();
  });
});

describe("command lists that change while loading", () => {
  it("drop an answer that started before the bot changed its commands", async () => {
    const send = fakeClient();
    let answer: (value: unknown) => void = () => {};
    const slow = {
      api: { get: () => new Promise((resolve) => (answer = resolve)) },
    } as unknown as Parameters<typeof loadServerCommands>[0];
    const loading = loadServerCommands(slow, "STALE");
    send({ type: "ApplicationCommandsUpdate", server_id: "STALE" });
    answer({ applications: [], commands: [] });
    await loading.catch(() => undefined);
    expect(interactionState.commands.STALE).toBeUndefined();
  });
});
