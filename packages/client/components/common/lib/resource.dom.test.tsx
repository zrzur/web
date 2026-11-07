import { createResource, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { resourceValue } from "./resource";

describe("resourceValue", () => {
  it("reading a failed resource directly throws; resourceValue gives undefined", async () => {
    await createRoot(async (dispose) => {
      const [failed] = createResource(() =>
        Promise.reject(new TypeError("Failed to fetch")),
      );
      await new Promise((r) => setTimeout(r, 10));
      expect(failed.error).toBeInstanceOf(TypeError);
      // what made the page error: a render that reads the value
      expect(() => failed()).toThrow("Failed to fetch");
      expect(resourceValue(failed)).toBeUndefined();
      dispose();
    });
  });

  it("gives the value of a loaded resource", async () => {
    await createRoot(async (dispose) => {
      const [ok] = createResource(() => Promise.resolve([1, 2]));
      await new Promise((r) => setTimeout(r, 10));
      expect(resourceValue(ok)).toEqual([1, 2]);
      dispose();
    });
  });
});
