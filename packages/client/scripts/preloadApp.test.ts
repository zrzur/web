import { describe, expect, it } from "vitest";

import { addPreloads, appPreloads } from "./preloadApp.mjs";

const chunk = (
  fileName: string,
  extra: {
    isEntry?: boolean;
    facadeModuleId?: string;
    imports?: string[];
  } = {},
) => ({
  type: "chunk",
  fileName,
  isEntry: extra.isEntry ?? false,
  facadeModuleId: extra.facadeModuleId ?? null,
  imports: extra.imports ?? [],
});

const bundle = Object.fromEntries(
  [
    chunk("assets/index-a.js", { isEntry: true, imports: ["assets/solid.js"] }),
    chunk("assets/solid.js"),
    chunk("assets/app-b.js", {
      facadeModuleId: "/x/packages/client/src/app.tsx",
      imports: ["assets/index-a.js", "assets/mount.js", "assets/core.js"],
    }),
    chunk("assets/mount.js", {
      imports: ["assets/core.js", "assets/solid.js"],
    }),
    chunk("assets/core.js"),
    chunk("assets/Discover.js"),
  ].map((c) => [c.fileName, c]),
);

describe("app preload", () => {
  it("lists the app and what it imports, not what the entry already loads", () => {
    expect(appPreloads(bundle)).toEqual([
      "assets/app-b.js",
      "assets/mount.js",
      "assets/core.js",
    ]);
  });

  it("puts the links before the entry script, with the base path", () => {
    const html =
      '<head>\n  <script type="module" crossorigin src="/zrzur/assets/index-a.js"></script>\n</head>';
    expect(addPreloads(html, ["assets/app-b.js"], "/zrzur/")).toBe(
      '<head>\n  <link rel="modulepreload" crossorigin href="/zrzur/assets/app-b.js">\n  <script type="module" crossorigin src="/zrzur/assets/index-a.js"></script>\n</head>',
    );
  });

  it("adds them once when the page is written again", () => {
    const html =
      '<script type="module" crossorigin src="/assets/index-a.js"></script>';
    const once = addPreloads(html, ["assets/app-b.js"], "/");
    expect(addPreloads(once, ["assets/app-b.js"], "/")).toBe(once);
  });

  it("leaves the page alone without an entry script", () => {
    expect(addPreloads("<head></head>", ["assets/app-b.js"], "/")).toBe(
      "<head></head>",
    );
  });
});
