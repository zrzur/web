import { describe, expect, it } from "vitest";

import { APPS_ACTIONS, auditQueryString } from "./auditQuery";

describe("audit log query", () => {
  it("sends every action type as its own repeated type key", () => {
    const query = auditQueryString({
      limit: 50,
      type: ["MemberEdit", "MemberKick", "BanCreate"],
    });
    const params = new URLSearchParams(query);
    expect(params.getAll("type")).toEqual([
      "MemberEdit",
      "MemberKick",
      "BanCreate",
    ]);
    expect(params.get("limit")).toBe("50");
  });

  it("leaves out empty filters", () => {
    const params = new URLSearchParams(
      auditQueryString({ limit: 50, user: undefined, type: [] }),
    );
    expect(params.has("user")).toBe(false);
    expect(params.has("type")).toBe(false);
  });

  it("keeps user and before", () => {
    const params = new URLSearchParams(
      auditQueryString({ limit: 10, user: "U1", before: "B1" }),
    );
    expect(params.get("user")).toBe("U1");
    expect(params.get("before")).toBe("B1");
  });
});

describe("Apps filter", () => {
  it("lists what bots and apps did to the server", () => {
    expect(APPS_ACTIONS).toEqual([
      "BotAdd",
      "BotRemove",
      "CommandPermissionsUpdate",
    ]);
    const params = new URLSearchParams(
      auditQueryString({ limit: 50, type: APPS_ACTIONS }),
    );
    expect(params.getAll("type")).toEqual(APPS_ACTIONS);
  });
});
