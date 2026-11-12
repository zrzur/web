import { describe, expect, it } from "vitest";

import { creatorShown } from "./botAbout";

describe("who made a bot", () => {
  const owner = "01OWNER";

  it("is shown by name when the owner chose to show it", () => {
    // readers other than the owner never get the owner's id
    expect(
      creatorShown({ creator: { username: "maker" } }, undefined, "01READER"),
    ).toEqual({ kind: "name", name: "maker" });
  });

  it("prefers the display name", () => {
    expect(
      creatorShown(
        { creator: { username: "maker", displayName: "Maker" } },
        undefined,
        "01READER",
      ),
    ).toEqual({ kind: "name", name: "Maker" });
  });

  it("stays hidden when the owner did not choose to show it", () => {
    expect(creatorShown({}, undefined, "01READER")).toBeUndefined();
  });

  it("stays hidden while the bot's page is loading or private", () => {
    expect(creatorShown(undefined, undefined, "01READER")).toBeUndefined();
  });

  it("is the owner's own profile on their own bot", () => {
    expect(creatorShown(undefined, owner, owner)).toEqual({
      kind: "self",
      id: owner,
    });
  });

  it("never treats a missing owner id as a match", () => {
    expect(creatorShown(undefined, undefined, undefined)).toBeUndefined();
    expect(creatorShown(undefined, "", "")).toBeUndefined();
  });
});
