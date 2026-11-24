import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  PROGRAM_BADGE,
  failureCode,
  programOf,
  programsApi,
} from "./programsApi";

describe("badge programs", () => {
  it("each program leads to its badge and back", () => {
    expect(programOf("partner")).toBe("partner");
    expect(programOf("verified_server_owner")).toBe("verified_server");
    expect(programOf("verified_bot_developer")).toBe("verified_bot");
    expect(programOf("creator")).toBeUndefined();
    expect(PROGRAM_BADGE.verified_bot).toBe("verified_bot_developer");
  });

  it("reads the code of a refused request, nothing else", () => {
    expect(
      failureCode({ type: "FailedValidation", error: "reapply_wait" }),
    ).toBe("reapply_wait");
    expect(
      failureCode(
        JSON.stringify({
          type: "FailedValidation",
          error: "not_eligible:members",
        }),
      ),
    ).toBe("not_eligible:members");
    expect(failureCode({ type: "NotFound" })).toBeUndefined();
    expect(failureCode("not json")).toBeUndefined();
    expect(failureCode(undefined)).toBeUndefined();
  });

  it("calls the program routes with their bodies", async () => {
    const calls: [string, string, unknown][] = [];
    const api = {
      get: vi.fn(
        async (path: string, params?: object) => (
          calls.push(["GET", path, params]),
          []
        ),
      ),
      post: vi.fn(
        async (path: string, body?: object) => (
          calls.push(["POST", path, body]),
          {}
        ),
      ),
      patch: vi.fn(
        async (path: string, body?: object) => (
          calls.push(["PATCH", path, body]),
          {}
        ),
      ),
    };
    const client = { api } as never;
    await programsApi.eligibility(client, "verified_server", "S1", true);
    await programsApi.create(client, {
      program: "partner",
      target_id: "S2",
      authorized: true,
    });
    await programsApi.challenge(client, "A1", "dns", "example.org");
    await programsApi.appeal(client, "A1", "Our site links to the server now.");
    expect(calls).toEqual([
      [
        "GET",
        "/badges/programs/verified_server/eligibility",
        { target: "S1", exception: true },
      ],
      [
        "POST",
        "/badges/applications",
        { program: "partner", target_id: "S2", authorized: true },
      ],
      [
        "POST",
        "/badges/applications/A1/ownership",
        { method: "dns", domain: "example.org" },
      ],
      [
        "POST",
        "/badges/applications/A1/appeal",
        { text: "Our site links to the server now." },
      ],
    ]);
  });

  it("every program text is translated in ar and de", () => {
    const json = JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../scripts/i18n/ui-2026112403.json",
          import.meta.url,
        ),
        "utf-8",
      ),
    ) as Record<string, [string, string]>;
    const catalog = (locale: string) =>
      readFileSync(
        new URL(
          `../../../../../i18n/catalogs/${locale}/messages.po`,
          import.meta.url,
        ),
        "utf-8",
      );
    const ar = catalog("ar");
    const de = catalog("de");
    expect(Object.keys(json).length).toBeGreaterThan(90);
    for (const [english, [arabic, german]] of Object.entries(json)) {
      expect(arabic, english).toMatch(/[؀-ۿ]/);
      expect(german.length, english).toBeGreaterThan(0);
      expect(ar).toContain(`msgstr ${JSON.stringify(arabic)}`);
      expect(de).toContain(`msgstr ${JSON.stringify(german)}`);
      // the same placeholders in every language
      const holes = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(holes(arabic), english).toEqual(holes(english));
      expect(holes(german), english).toEqual(holes(english));
    }
  });
});
