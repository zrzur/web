import { describe, expect, it, vi } from "vitest";

import { Sync } from "./Sync";

describe("Sync.initialSync", () => {
  it("keeps the local settings when the request fails", async () => {
    const sync = Object.create(Sync.prototype) as Sync;
    const merge = vi.fn();
    (sync as unknown as { merge: unknown }).merge = merge;
    const client = {
      api: {
        post: vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
      },
    };
    await expect(sync.initialSync(client as never)).resolves.toBeUndefined();
    expect(merge).not.toHaveBeenCalled();
  });
});
