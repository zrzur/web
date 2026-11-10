import { describe, expect, test } from "vitest";

import { resolveReleaseChannel } from "./env";

describe("release channel (VITE_RELEASE_CHANNEL)", () => {
  test("a local build without the variable is a beta", () => {
    expect(resolveReleaseChannel(undefined)).toBe("beta");
    expect(resolveReleaseChannel("")).toBe("beta");
  });

  test("beta shows the label, in any case and with spaces", () => {
    expect(resolveReleaseChannel("beta")).toBe("beta");
    expect(resolveReleaseChannel(" Beta ")).toBe("beta");
  });

  test("anything else is stable, also the container's default", () => {
    // docker/inject.js writes "stable" when the container sets nothing
    expect(resolveReleaseChannel("stable")).toBe("stable");
    expect(resolveReleaseChannel("production")).toBe("stable");
  });
});
