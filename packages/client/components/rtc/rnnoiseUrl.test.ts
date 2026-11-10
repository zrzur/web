import { describe, expect, it } from "vitest";

import { rnnoiseFolder } from "./rnnoiseUrl";

describe("noise filter files", () => {
  it("come from the app itself by default", () => {
    expect(
      rnnoiseFolder(undefined, "/", "https://app.zrzur.com/server/x"),
    ).toBe("https://app.zrzur.com/assets/rnnoise/");
  });

  it("follow the base path of the build", () => {
    expect(rnnoiseFolder("", "/beta/", "https://zrzur.example/beta/app")).toBe(
      "https://zrzur.example/beta/assets/rnnoise/",
    );
  });

  it("use a configured folder when there is one", () => {
    expect(
      rnnoiseFolder("https://cdn.example.org/rnnoise/", "/", "https://a.b/"),
    ).toBe("https://cdn.example.org/rnnoise/");
  });

  it("never point at a public CDN on their own", () => {
    expect(rnnoiseFolder(undefined, "/", "http://127.0.0.1:5000/")).not.toMatch(
      /jsdelivr/,
    );
  });
});
