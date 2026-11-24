import { describe, expect, it } from "vitest";

import { detectedNow, detectionStatus } from "./detectionStatus";

describe("detectionStatus", () => {
  it("a browser has no desktop app: it says where detection happens", () => {
    expect(
      detectionStatus({ native: false, bridge: false, sharing: true }),
    ).toBe("browser");
  });

  it("a desktop app without the activity bridge is too old", () => {
    expect(
      detectionStatus({ native: true, bridge: false, sharing: true }),
    ).toBe("update");
    // an update is the answer whether or not sharing is on
    expect(
      detectionStatus({ native: true, bridge: false, sharing: false }),
    ).toBe("update");
  });

  it("a desktop app with the bridge detects only while sharing", () => {
    expect(detectionStatus({ native: true, bridge: true, sharing: true })).toBe(
      "live",
    );
    expect(
      detectionStatus({ native: true, bridge: true, sharing: false }),
    ).toBe("off");
  });
});

describe("detectedNow", () => {
  type Reported = { type: string; name: string };
  const game: Reported = { type: "Playing", name: "Rust" };
  const app: Reported = { type: "Using", name: "Visual Studio Code" };

  it("nothing reported is nothing", () => {
    expect(detectedNow(undefined)).toBeUndefined();
    expect(detectedNow({ rpc: null, desktop: null })).toBeUndefined();
  });

  it("an app's own report comes before what the desktop saw", () => {
    expect(detectedNow({ rpc: game, desktop: app })).toEqual(game);
    expect(detectedNow({ rpc: null, desktop: app })).toEqual(app);
  });

  it("a report without a name is nothing", () => {
    expect(
      detectedNow({ rpc: { type: "Playing", name: "  " }, desktop: null }),
    ).toBeUndefined();
  });
});
