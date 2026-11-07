import { describe, expect, it } from "vitest";

import { isolate } from "./isolate";

describe("isolate", () => {
  it("wraps a name in first-strong isolate marks", () => {
    expect(isolate("Wings UI (ar)")).toBe("\u2068Wings UI (ar)\u2069");
  });
});
