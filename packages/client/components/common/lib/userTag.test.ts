import { describe, expect, it } from "vitest";

import { UNIQUE_TAG, hasOldTag, userHandle, userTag } from "./userTag";

describe("userTag", () => {
  const owner = { username: "layla", discriminator: UNIQUE_TAG };
  const old = { username: "omar", discriminator: "1151" };

  it("shows no tag for an account that owns its username", () => {
    expect(hasOldTag(owner)).toBe(false);
    expect(userTag(owner)).toBe("");
    expect(userHandle(owner)).toBe("layla");
  });

  it("keeps the tag of an account from before unique usernames", () => {
    expect(hasOldTag(old)).toBe(true);
    expect(userTag(old)).toBe("#1151");
    expect(userHandle(old)).toBe("omar#1151");
  });

  it("hides the digits in streamer mode, and still shows nothing without a tag", () => {
    expect(userHandle(old, true)).toBe("omar#••••");
    expect(userHandle(owner, true)).toBe("layla");
  });

  it("copes with a missing user", () => {
    expect(hasOldTag(undefined)).toBe(false);
    expect(userTag(null)).toBe("");
    expect(userHandle(undefined)).toBe("");
    expect(userHandle({ username: "x" })).toBe("x");
  });
});
