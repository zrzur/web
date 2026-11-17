import { describe, expect, it } from "vitest";

import { usernameNoticeDue, usernameNoticeKey } from "./usernameNoticeDue";

const DAY = 24 * 60 * 60 * 1000;
const store = (value: string | null) => ({ getItem: () => value });

describe("usernameNoticeDue", () => {
  it("is due on a device that never told this account", () => {
    expect(usernameNoticeDue("u1", 5 * DAY, store(null))).toBe(true);
  });

  it("waits a day after the last time", () => {
    const now = 10 * DAY;
    expect(usernameNoticeDue("u1", now, store(String(now - DAY + 1)))).toBe(
      false,
    );
    expect(usernameNoticeDue("u1", now, store(String(now - DAY)))).toBe(true);
  });

  it("is due when the stored value is not a time or storage is refused", () => {
    expect(usernameNoticeDue("u1", DAY, store("soon"))).toBe(true);
    expect(usernameNoticeDue("u1", DAY, undefined)).toBe(true);
    expect(
      usernameNoticeDue("u1", DAY, {
        getItem: () => {
          throw new Error("refused");
        },
      }),
    ).toBe(true);
  });

  it("keeps one time per account", () => {
    expect(usernameNoticeKey("a")).not.toBe(usernameNoticeKey("b"));
  });
});
