import { describe, expect, it } from "vitest";

import { mergeMembers, needsServerSearch } from "./memberPages";

const member = (user: string) => ({ id: { server: "s", user } });

describe("member pages", () => {
  it("joins pages and search results without duplicates, in order", () => {
    const merged = mergeMembers(
      [[member("a"), member("b")], [member("c")]],
      [member("b"), member("z")],
    );
    expect(merged.map((m) => m.id.user)).toEqual(["a", "b", "c", "z"]);
  });

  it("asks the server only while members are still unloaded", () => {
    expect(needsServerSearch("al", true)).toBe(true);
    expect(needsServerSearch("al", false)).toBe(false);
    expect(needsServerSearch(" a ", true)).toBe(false);
    expect(needsServerSearch("", true)).toBe(false);
  });
});

describe("member page query", () => {
  it("sends limit and after", async () => {
    const { memberPageQuery } = await import("./memberPages");
    const params = new URLSearchParams(
      memberPageQuery({ limit: 100, after: "01ABC" }),
    );
    expect(params.get("limit")).toBe("100");
    expect(params.get("after")).toBe("01ABC");
    expect(memberPageQuery({})).toBe("");
  });
});
