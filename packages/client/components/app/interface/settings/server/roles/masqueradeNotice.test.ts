import { describe, expect, it } from "vitest";

import { everyoneCanMasquerade, withoutMasquerade } from "./masqueradeNotice";

const MASQUERADE = 2n ** 28n;
const SEND = 2n ** 22n;

describe("masquerade notice", () => {
  it("shows only when @everyone may masquerade", () => {
    expect(everyoneCanMasquerade(SEND | MASQUERADE)).toBe(true);
    expect(everyoneCanMasquerade(SEND)).toBe(false);
  });

  it("turns off masquerade and keeps the rest", () => {
    expect(withoutMasquerade(SEND | MASQUERADE)).toBe(Number(SEND));
  });
});
