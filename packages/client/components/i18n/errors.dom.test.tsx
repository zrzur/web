import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { ApiError } from "@zrzur/sdk";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { errorDetails, useError } from "./errors";

let dispose: (() => void) | undefined;
let translate: ReturnType<typeof useError>;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        {(() => {
          translate = useError();
          return null;
        })()}
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
});
afterEach(() => dispose?.());

describe("validation errors", () => {
  const RAW =
    'statement: Validation error: length [{"min": 20, "max": 1000, "value": "hi"}]';

  it("the verification form says what the field needs", () => {
    const error = new ApiError(400, "POST", "/bots/1/verification", {
      type: "FailedValidation",
      error: "statement must be between 20 and 1000 characters",
      fields: [{ field: "statement", rule: "length", min: 20, max: 1000 }],
    });
    expect(translate(error)).toBe(
      "Description: Between 20 and 1000 characters.",
    );
  });

  it("names the link that is wrong", () => {
    const error = new ApiError(400, "POST", "/bots/1/verification", {
      type: "FailedValidation",
      fields: [{ field: "privacy_policy_url", rule: "https" }],
    });
    expect(translate(error)).toBe(
      "Privacy policy link: Use a link that starts with https://",
    );
  });

  it("shows no raw validator text from an older server, nowhere", () => {
    const error = new ApiError(400, "POST", "/bots/1/verification", {
      type: "FailedValidation",
      error: RAW,
      location: "crates/delta/src/routes/bots/verification.rs:143:9",
    });
    const shown = `${translate(error)}\n${errorDetails(error)}`;
    for (const raw of ["Validation error", "length [", "crates/", "/bots/1"])
      expect(shown).not.toContain(raw);
    expect(translate(error)).toBe(
      "Something you entered isn't valid. Check it and try again.",
    );
    expect(errorDetails(RAW)).toBeUndefined();
  });

  it("keeps paths with tokens out of Details", () => {
    const error = new ApiError(500, "POST", "/webhooks/1/secret-token", {
      type: "InternalError",
      location: "crates/core/src/lib.rs:1:1",
    });
    expect(errorDetails(error)).toBe("InternalError");
  });

  it("says who can hold the creator rank", () => {
    const error = {
      type: "FailedValidation",
      fields: [{ field: "user", rule: "adult" }],
    };
    expect(translate(error)).toContain(
      "Only people who declared they are 18 or over can be creators.",
    );
  });

  it("a rule it does not know falls back to plain words", () => {
    const error = {
      type: "FailedValidation",
      fields: [{ field: "x", rule: "new" }],
    };
    expect(translate(error)).toBe(
      "Something you entered isn't valid. Check it and try again.",
    );
  });
});

describe("the weekly bot limit", () => {
  it("says the limit and the day it resets", () => {
    const resets_at = Date.UTC(2026, 10, 13, 12);
    const message = translate({
      type: "TooManyBotCreations",
      max: 7,
      resets_at,
    });
    expect(message).toContain("limit of 7 new bots a week");
    expect(message).toContain("2026");
  });

  it("still explains the reset without a date", () => {
    expect(translate({ type: "TooManyBotCreations", max: 7 })).toContain(
      "Each one counts for 7 days",
    );
  });
});

describe("useError rate limits", () => {
  it("a plain 429 from the SDK says when to try again", () => {
    // the SDK's ApiError: `type` is "Unknown" when the body had none
    const error = new ApiError(429, "POST", "/x", { retry_after: 7000 }, 7000);
    expect(error.type).toBe("Unknown");
    expect(translate(error)).toMatch(/Try again in 7 seconds/);
  });

  it("says second for one", () => {
    const error = new ApiError(429, "POST", "/x", { retry_after: 400 }, 400);
    expect(translate(error)).toMatch(/Try again in 1 second\./);
  });

  it("a raw body without a type still works", () => {
    expect(translate({ retry_after: 3000 })).toMatch(/in 3 seconds/);
  });

  it("a typed 429 keeps its own words", () => {
    const error = new ApiError(429, "POST", "/x", {
      type: "InSlowmode",
      retry_after: 3000,
    });
    expect(translate(error)).not.toMatch(/Try again in 3 seconds/);
  });
});
