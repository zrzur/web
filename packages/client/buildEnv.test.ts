import { describe, expect, it } from "vitest";

import { assertBuildEnvSafe } from "./buildEnv";

const zrzur = {
  VITE_HOST: "app.zrzur.com",
  VITE_API_URL: "https://api.zrzur.com",
  VITE_INVITE_ORIGIN: "https://zrzur.cc",
};

describe("assertBuildEnvSafe", () => {
  it("never checks the dev server", () => {
    expect(() => assertBuildEnvSafe("serve", {})).not.toThrow();
  });

  it("production build requires the invite origin", () => {
    const { VITE_INVITE_ORIGIN: _, ...noInvite } = zrzur;
    expect(() => assertBuildEnvSafe("build", noInvite)).toThrow(
      /VITE_INVITE_ORIGIN/,
    );
  });

  it("production build passes with Zrzur hosts", () => {
    expect(() => assertBuildEnvSafe("build", zrzur)).not.toThrow();
  });

  it("accepts the Docker runtime placeholders", () => {
    expect(() =>
      assertBuildEnvSafe("build", {
        VITE_HOST: "__VITE_HOST__",
        VITE_API_URL: "__VITE_API_URL__",
        VITE_INVITE_ORIGIN: "__VITE_INVITE_ORIGIN__",
      }),
    ).not.toThrow();
  });

  it("refuses an upstream invite short-link host", () => {
    expect(() =>
      assertBuildEnvSafe("build", {
        ...zrzur,
        VITE_INVITE_ORIGIN: "https://stt.gg",
      }),
    ).toThrow(/VITE_INVITE_ORIGIN/);
  });
});
