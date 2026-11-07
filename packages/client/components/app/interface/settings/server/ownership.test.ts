import { describe, expect, it } from "vitest";

import { canTransferTo, confirmsName } from "./ownership";

describe("ownership transfer", () => {
  const server = { ownerId: "owner" };

  it("only goes to a person who is not the owner already", () => {
    expect(canTransferTo({ id: "member" }, server)).toBe(true);
    expect(canTransferTo({ id: "owner" }, server)).toBe(false);
    expect(canTransferTo({ id: "bot", bot: { owner: "x" } }, server)).toBe(
      false,
    );
  });

  it("is confirmed by the server name, ignoring case and spaces", () => {
    expect(confirmsName("speed test", "Speed test")).toBe(true);
    expect(confirmsName("  Speed   test ", "Speed test")).toBe(true);
    expect(confirmsName("Speed", "Speed test")).toBe(false);
    expect(confirmsName("", "")).toBe(false);
  });
});
