import { describe, expect, it } from "vitest";

import { cleanChoices } from "./soundboardSettings";

describe("soundboard choices", () => {
  it("plays at full volume until the person chooses otherwise", () => {
    expect(cleanChoices(undefined)).toEqual({ muted: false, volume: 1 });
    expect(cleanChoices(null)).toEqual({ muted: false, volume: 1 });
  });

  it("keeps a saved choice inside 0-1 and drops nonsense", () => {
    expect(cleanChoices({ muted: true, volume: 0.4 })).toEqual({
      muted: true,
      volume: 0.4,
    });
    expect(cleanChoices({ volume: 7 }).volume).toBe(1);
    expect(cleanChoices({ volume: -1 }).volume).toBe(0);
    expect(cleanChoices({ volume: Number.NaN }).volume).toBe(1);
    expect(cleanChoices({ muted: "yes" }).muted).toBe(false);
    expect(cleanChoices("garbage")).toEqual({ muted: false, volume: 1 });
  });
});
