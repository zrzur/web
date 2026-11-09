import { describe, expect, it } from "vitest";

import { dedupeCommands, dmCommands, typedCommand } from "./commandList";
import type { ApplicationCommand } from "./types";

const command = (
  fields: Partial<ApplicationCommand> & { _id: string; name: string },
): ApplicationCommand =>
  ({
    application_id: "BOT",
    type: "ChatInput",
    description: "",
    version: "1",
    ...fields,
  }) as ApplicationCommand;

describe("dedupeCommands", () => {
  it("keeps one copy when a bot has a global and a server command of the same name: the server copy", () => {
    const global = command({ _id: "G", name: "close" });
    const local = command({ _id: "S", name: "close", server_id: "SRV" });
    const reply = command({ _id: "R", name: "reply" });
    expect(dedupeCommands([global, reply, local]).map((c) => c._id)).toEqual([
      "R",
      "S",
    ]);
    // order of the answer does not matter
    expect(dedupeCommands([local, global, reply]).map((c) => c._id)).toEqual([
      "S",
      "R",
    ]);
  });

  it("keeps commands of different bots, or of different kinds, apart", () => {
    const a = command({ _id: "A", name: "close" });
    const b = command({ _id: "B", name: "close", application_id: "OTHER" });
    const menu = command({ _id: "M", name: "close", type: "Message" });
    expect(dedupeCommands([a, b, menu])).toHaveLength(3);
  });
});

describe("typedCommand", () => {
  const close = command({ _id: "S", name: "close", server_id: "SRV" });
  const reply = command({ _id: "R", name: "reply" });
  const label = (c: ApplicationCommand) => c.name;

  it("finds the command typed in full, then Enter: /close", () => {
    expect(typedCommand("/close", [close, reply], label)?._id).toBe("S");
    expect(typedCommand("/close  ", [close, reply], label)?._id).toBe("S");
  });

  it("finds it by its translated name too", () => {
    const named = command({
      _id: "N",
      name: "close",
      name_localizations: { ar: "إغلاق" },
    });
    expect(typedCommand("/إغلاق", [named], () => "إغلاق")?._id).toBe("N");
  });

  it("gives nothing for text that is not one whole command", () => {
    expect(typedCommand("/clo", [close, reply], label)).toBeUndefined();
    expect(typedCommand("/close now", [close, reply], label)).toBeUndefined();
    expect(typedCommand("close", [close, reply], label)).toBeUndefined();
    expect(typedCommand("/shrug", [close, reply], label)).toBeUndefined();
  });

  it("gives nothing when two bots share the name: the list decides", () => {
    const other = command({ _id: "O", name: "close", application_id: "X" });
    expect(typedCommand("/close", [close, other], label)).toBeUndefined();
  });
});

describe("dmCommands", () => {
  it("offers the bot's global commands that work without a server", () => {
    const list = dmCommands({ _id: "BOT", username: "helper" }, [
      command({ _id: "1", name: "hello" }),
      command({ _id: "2", name: "ban", default_member_permissions: 128 }),
      command({ _id: "3", name: "spicy", nsfw: true }),
      command({ _id: "4", name: "local", server_id: "SRV" }),
    ]);
    expect(list.applications).toEqual([{ _id: "BOT", username: "helper" }]);
    expect(list.commands.map((c) => c.name)).toEqual(["hello"]);
  });
});
