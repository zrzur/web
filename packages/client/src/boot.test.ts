import { describe, expect, it } from "vitest";

import { opensSignIn } from "./boot";

describe("first download", () => {
  it("fetches the sign-in pages with the app on a sign-in address", () => {
    expect(opensSignIn("/login")).toBe(true);
    expect(opensSignIn("/login/create")).toBe(true);
    expect(opensSignIn("/login/verify/abc")).toBe(true);
    expect(opensSignIn("/i/example.org/login/auth")).toBe(true);
  });

  it("leaves them out everywhere else", () => {
    expect(opensSignIn("/")).toBe(false);
    expect(opensSignIn("/app")).toBe(false);
    expect(opensSignIn("/loginx")).toBe(false);
    expect(opensSignIn("/server/1/channel/2")).toBe(false);
    expect(opensSignIn("/discover/login")).toBe(false);
  });
});
