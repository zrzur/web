import { describe, expect, it } from "vitest";

import { STAFF_TOOLS_ENABLED } from "./staffTools";

describe("staff tools", () => {
  it("stay hidden until the admin and creator panels are designed", () => {
    expect(STAFF_TOOLS_ENABLED).toBe(false);
  });
});
