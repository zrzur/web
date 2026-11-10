import { describe, expect, it } from "vitest";

import { asksForCaptcha, loginCredentials } from "./loginStepUp";

describe("sign-in step-up", () => {
  it("a CaptchaFailed answer asks for the captcha on the next try", () => {
    expect(asksForCaptcha({ type: "CaptchaFailed" })).toBe(true);
  });

  it("other answers do not", () => {
    expect(asksForCaptcha({ type: "InvalidCredentials" })).toBe(false);
    expect(asksForCaptcha({ type: "LockedOut" })).toBe(false);
    expect(asksForCaptcha("CaptchaFailed")).toBe(false);
    expect(asksForCaptcha(undefined)).toBe(false);
    expect(asksForCaptcha(null)).toBe(false);
  });

  it("sends the captcha token only when there is one", () => {
    expect(loginCredentials("a@b.c", "pw")).toEqual({
      email: "a@b.c",
      password: "pw",
    });
    expect(loginCredentials("a@b.c", "pw", "")).toEqual({
      email: "a@b.c",
      password: "pw",
    });
    expect(loginCredentials("a@b.c", "pw", "token")).toEqual({
      email: "a@b.c",
      password: "pw",
      captcha: "token",
    });
  });
});
