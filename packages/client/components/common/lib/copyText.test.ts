import { describe, expect, it } from "vitest";

import { copyText } from "./copyText";

describe("copyText", () => {
  it("says yes when the browser took the text", async () => {
    const taken: string[] = [];
    const clipboard = {
      writeText: async (text: string) => void taken.push(text),
    };
    await expect(copyText("sara#4321", clipboard)).resolves.toBe(true);
    expect(taken).toEqual(["sara#4321"]);
  });

  it("says no, without throwing, when the browser refuses", async () => {
    const clipboard = {
      writeText: () =>
        Promise.reject(
          new DOMException("Write permission denied.", "NotAllowedError"),
        ),
    };
    await expect(copyText("sara#4321", clipboard)).resolves.toBe(false);
  });

  it("says no when there is no clipboard at all", async () => {
    await expect(copyText("sara#4321", undefined)).resolves.toBe(false);
  });
});
