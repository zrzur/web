import { describe, expect, it } from "vitest";

import { systemMessagesPatch } from "./systemMessages";

describe("systemMessagesPatch", () => {
  it("drops the ones set to Off and keeps the rest", () => {
    expect(
      systemMessagesPatch(
        { user_joined: "a", user_left: "b" },
        {
          user_joined: "none",
          user_left: "b",
          user_kicked: "c",
          user_banned: "none",
        },
      ),
    ).toEqual({ user_left: "b", user_kicked: "c" });
  });

  it("is empty when every message is Off", () => {
    expect(
      systemMessagesPatch(undefined, {
        user_joined: "none",
        user_left: "none",
        user_kicked: "none",
        user_banned: "none",
      }),
    ).toEqual({});
  });
});
