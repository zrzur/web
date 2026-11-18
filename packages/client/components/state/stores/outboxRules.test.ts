import { describe, expect, it } from "vitest";

import { outboxRetryDelay, outcomeOfError, waitsToBeSent } from "./outboxRules";

describe("a message that could not be sent", () => {
  it("waits when the network gave no answer", () => {
    expect(outcomeOfError(new TypeError("Failed to fetch"))).toEqual({
      kind: "wait",
    });
    expect(outcomeOfError(undefined)).toEqual({ kind: "wait" });
    expect(outcomeOfError("Upload Error")).toEqual({ kind: "wait" });
  });

  it("counts as sent when the server already has this exact message", () => {
    expect(outcomeOfError({ type: "DuplicateNonce" })).toEqual({
      kind: "sent",
    });
  });

  it("waits on a fault of the server, not of the message", () => {
    expect(outcomeOfError({ type: "InternalError" })).toEqual({ kind: "wait" });
    expect(outcomeOfError({ type: "DatabaseError" })).toEqual({ kind: "wait" });
  });

  it("stays, marked, when the server refused the message itself", () => {
    expect(outcomeOfError({ type: "MissingPermission" })).toEqual({
      kind: "failed",
      error: "MissingPermission",
    });
    expect(outcomeOfError({ type: "PayloadTooLarge" })).toEqual({
      kind: "failed",
      error: "PayloadTooLarge",
    });
  });
});

describe("the queue", () => {
  it("sends by itself only what waits, never what was refused or is on its way", () => {
    expect(waitsToBeSent({ status: "unsent" })).toBe(true);
    expect(waitsToBeSent({ status: "failed" })).toBe(false);
    expect(waitsToBeSent({ status: "sending" })).toBe(false);
  });

  it("waits longer after each failed pass, never more than a minute", () => {
    expect(outboxRetryDelay(1)).toBe(2_000);
    expect(outboxRetryDelay(2)).toBe(4_000);
    expect(outboxRetryDelay(3)).toBe(8_000);
    expect(outboxRetryDelay(20)).toBe(60_000);
    expect(outboxRetryDelay(0)).toBe(2_000);
  });
});
