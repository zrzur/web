import { describe, expect, it } from "vitest";

import {
  MAX_RETRY_SECONDS,
  reconnectDelay,
} from "../components/client/reconnectDelay";
import { loaded } from "../components/common/lib/loaded";

describe("reconnectDelay", () => {
  it("backs off exponentially at first", () => {
    expect(reconnectDelay(1, 0.5)).toBe(1);
    expect(reconnectDelay(2, 0.5)).toBe(3);
    expect(reconnectDelay(4, 0.5)).toBe(15);
  });

  it("never waits much more than the cap, however many failures", () => {
    for (const failures of [5, 10, 20, 64]) {
      expect(reconnectDelay(failures, 1)).toBeLessThanOrEqual(
        MAX_RETRY_SECONDS * 1.2 + 1e-9,
      );
      expect(reconnectDelay(failures, 0)).toBeGreaterThanOrEqual(
        MAX_RETRY_SECONDS * 0.8 - 1e-9,
      );
    }
  });
});

describe("loaded", () => {
  it("does not touch data while the query is pending", () => {
    const pending = {
      isSuccess: false,
      get data(): string {
        // solid-query would suspend the nearest <Suspense> here
        throw new Error("data read while pending");
      },
    };
    expect(loaded(pending)).toBeUndefined();
  });

  it("returns data once the query has succeeded", () => {
    expect(loaded({ isSuccess: true, data: [1, 2] })).toEqual([1, 2]);
  });
});
