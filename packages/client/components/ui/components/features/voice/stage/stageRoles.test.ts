import { describe, expect, it } from "vitest";

import { stageRoles } from "./stageRoles";

describe("stage roles", () => {
  it("splits the call into speakers, raised hands and the audience", () => {
    const roles = stageRoles(
      { speakers: ["host"], hands: ["asker"], topic: "Q&A" },
      ["host", "asker", "quiet", "me"],
      "me",
    );
    expect(roles.speakers).toEqual(["host"]);
    expect(roles.hands).toEqual(["asker"]);
    expect(roles.audience).toEqual(["quiet", "me"]);
    expect(roles.mine).toBe("audience");
  });

  it("says what you are", () => {
    const state = { speakers: ["me"], hands: [] };
    expect(stageRoles(state, ["me"], "me").mine).toBe("speaker");
    expect(stageRoles({ speakers: [], hands: ["me"] }, ["me"], "me").mine).toBe(
      "hand",
    );
  });

  it("leaves out people who already left the call", () => {
    const roles = stageRoles(
      { speakers: ["gone", "host"], hands: ["left"] },
      ["host"],
      "me",
    );
    expect(roles.speakers).toEqual(["host"]);
    expect(roles.hands).toEqual([]);
    // you count as in the call before the roster catches up
    expect(roles.audience).toEqual(["me"]);
  });

  it("never lists a speaker as a raised hand too", () => {
    const roles = stageRoles(
      { speakers: ["a"], hands: ["a", "b"] },
      ["a", "b"],
      "a",
    );
    expect(roles.hands).toEqual(["b"]);
  });
});
