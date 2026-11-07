import { describe, expect, it } from "vitest";

import { desktopScheme } from "./desktopScheme";

describe("desktopScheme", () => {
  it("uses zrzur-beta for the beta app and zrzur otherwise", () => {
    expect(desktopScheme("https://beta.zrzur.com")).toBe("zrzur-beta");
    expect(desktopScheme("https://app.zrzur.com")).toBe("zrzur");
    expect(desktopScheme("")).toBe("zrzur");
  });
});
