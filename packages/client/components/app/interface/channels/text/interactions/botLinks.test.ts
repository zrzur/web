import { describe, expect, it } from "vitest";

import {
  botStartState,
  markStarted,
  startOf,
  validStartPayload,
  waitForStart,
  waitingPayload,
} from "./botLinks";

describe("bot links", () => {
  it("accept the payloads the server accepts", () => {
    expect(validStartPayload("spring-sale_2")).toBe(true);
    expect(validStartPayload("x".repeat(64))).toBe(true);
    expect(validStartPayload("x".repeat(65))).toBe(false);
    expect(validStartPayload("has space")).toBe(false);
    expect(validStartPayload("عربي")).toBe(false);
    expect(validStartPayload("")).toBe(false);
    expect(validStartPayload(null)).toBe(false);
  });

  it("open the conversation with ?start, and keep only a valid payload", () => {
    expect(startOf("?start=ref-1")).toEqual({ payload: "ref-1" });
    expect(startOf("?start")).toEqual({});
    expect(startOf("?start=")).toEqual({});
    expect(startOf("?start=bad%20one")).toEqual({});
    expect(startOf("?permissions=8")).toBeUndefined();
    expect(startOf("")).toBeUndefined();
  });

  it("wait for Start until it is pressed, then are used up", () => {
    waitForStart("C1", "ref-1");
    waitForStart("C2");
    expect(waitingPayload("C1")).toBe("ref-1");
    expect(waitingPayload("C2")).toBeUndefined();
    expect(botStartState.waiting.C2).toBe("");

    markStarted("C1");
    expect(waitingPayload("C1")).toBeUndefined();
    expect(botStartState.waiting.C1).toBeUndefined();
    expect(botStartState.started.C1).toBe(true);

    // a new link for the same conversation waits again
    waitForStart("C1", "ref-2");
    expect(botStartState.started.C1).toBeUndefined();
    expect(waitingPayload("C1")).toBe("ref-2");
  });
});
