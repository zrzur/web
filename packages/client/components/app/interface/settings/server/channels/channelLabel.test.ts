import { describe, expect, it } from "vitest";

import { channelLabel } from "./channelLabel";

describe("channelLabel", () => {
  it("keeps # in front of the name in Arabic (isolated from the text around it)", () => {
    expect(channelLabel("welcome")).toBe("\u2068#welcome\u2069");
  });
});
