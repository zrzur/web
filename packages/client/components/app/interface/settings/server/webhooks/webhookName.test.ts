import { describe, expect, it } from "vitest";

import { webhookNameProblem } from "./webhookName";

describe("webhook name", () => {
  it("needs 1 to 80 characters", () => {
    expect(webhookNameProblem("")).toBe("empty");
    expect(webhookNameProblem("   ")).toBe("empty");
    expect(webhookNameProblem("deploys")).toBeUndefined();
    expect(webhookNameProblem("x".repeat(80))).toBeUndefined();
    expect(webhookNameProblem("x".repeat(81))).toBe("long");
    // characters, not bytes
    expect(webhookNameProblem("ب".repeat(80))).toBeUndefined();
  });
});
