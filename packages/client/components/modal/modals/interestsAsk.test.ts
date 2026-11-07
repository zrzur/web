import { describe, expect, it } from "vitest";

import { interestsKey, shouldAskInterests } from "./interestsAsk";

const questions = [
  { options: [{ role: "gamer" }, { role: "artist" }] },
  { options: [{ role: "arabic" }] },
];

describe("shouldAskInterests", () => {
  it("asks a new member who holds none of the answer roles", () => {
    expect(shouldAskInterests(questions, ["unrelated"], false)).toBe(true);
  });

  it("does not ask when the server has no questions", () => {
    expect(shouldAskInterests(undefined, [], false)).toBe(false);
    expect(shouldAskInterests([], [], false)).toBe(false);
    expect(shouldAskInterests([{ options: [] }], [], false)).toBe(false);
  });

  it("does not ask someone who already picked an answer", () => {
    expect(shouldAskInterests(questions, ["arabic"], false)).toBe(false);
  });

  it("does not ask again after Skip or Done on this device", () => {
    expect(shouldAskInterests(questions, [], true)).toBe(false);
  });
});

describe("interestsKey", () => {
  it("is per server and per person", () => {
    expect(interestsKey("S1", "U1")).toBe("zrzur:interests:S1:U1");
  });
});
