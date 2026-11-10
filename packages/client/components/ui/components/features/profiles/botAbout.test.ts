import { describe, expect, it } from "vitest";

import { showsCreator } from "./botAbout";

describe("who made a bot", () => {
  const owner = "01OWNER";

  it("is shown when the owner chose to show it", () => {
    expect(
      showsCreator({ creator: { username: "maker" } }, owner, "01READER"),
    ).toBe(true);
  });

  it("stays hidden when the owner did not choose to show it", () => {
    expect(showsCreator({}, owner, "01READER")).toBe(false);
  });

  it("stays hidden while the bot's page is loading or private", () => {
    expect(showsCreator(undefined, owner, "01READER")).toBe(false);
  });

  it("is shown to the owner on their own bot", () => {
    expect(showsCreator(undefined, owner, owner)).toBe(true);
  });

  it("is hidden without a known owner", () => {
    expect(showsCreator({ creator: { username: "m" } }, "", undefined)).toBe(
      false,
    );
  });
});
