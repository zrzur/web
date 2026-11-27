import { describe, expect, it } from "vitest";

import type { State } from "..";

import { LobbySteps } from "./LobbySteps";

describe("LobbySteps", () => {
  const store = new LobbySteps({} as State);

  it("keeps only known steps, once each, per server", () => {
    expect(
      store.clean({
        s1: ["rules", "rules", "hello", "nope" as never],
        s2: [],
        s3: "bad" as never,
      }),
    ).toEqual({ s1: ["rules", "hello"] });
  });

  it("starts empty", () => {
    expect(store.default()).toEqual({});
  });
});
