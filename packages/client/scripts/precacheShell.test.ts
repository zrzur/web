import { describe, expect, it } from "vitest";

import { precacheShell, shellFiles } from "./precacheShell.mjs";

const chunk = (
  fileName: string,
  extra: {
    isEntry?: boolean;
    facadeModuleId?: string;
    imports?: string[];
    css?: string[];
  } = {},
) => ({
  type: "chunk",
  fileName,
  isEntry: extra.isEntry ?? false,
  facadeModuleId: extra.facadeModuleId ?? null,
  imports: extra.imports ?? [],
  viteMetadata: { importedCss: new Set(extra.css ?? []) },
});

const bundle = Object.fromEntries(
  [
    chunk("assets/index.js", {
      isEntry: true,
      imports: ["assets/shared.js"],
      css: ["assets/index.css"],
    }),
    chunk("assets/shared.js"),
    chunk("assets/ChannelPage.js", {
      facadeModuleId:
        "/x/packages/client/src/interface/channels/ChannelPage.tsx",
      imports: ["assets/message.js"],
    }),
    chunk("assets/message.js"),
    chunk("assets/Settings.js", {
      facadeModuleId: "/x/packages/client/components/Settings.tsx",
    }),
    chunk("assets/messages-ar.js"),
  ].map((c) => [c.fileName, c]),
);

describe("precache shell", () => {
  it("takes the entry, its CSS and imports, and the chat screens", () => {
    expect([...shellFiles(bundle)].sort()).toEqual([
      "assets/ChannelPage.js",
      "assets/index.css",
      "assets/index.js",
      "assets/message.js",
      "assets/shared.js",
    ]);
  });

  it("takes the app the first file loads, and leaves out the Discover and Designs sites", () => {
    const split = Object.fromEntries(
      [
        chunk("assets/index.js", { isEntry: true }),
        chunk("assets/app.js", {
          facadeModuleId: "/x/packages/client/src/app.tsx",
          imports: ["assets/mount.js"],
        }),
        chunk("assets/mount.js"),
        chunk("assets/sites.js", {
          facadeModuleId: "/x/packages/client/src/sites.tsx",
          imports: ["assets/mount.js"],
        }),
      ].map((c) => [c.fileName, c]),
    );
    expect([...shellFiles(split)].sort()).toEqual([
      "assets/app.js",
      "assets/index.js",
      "assets/mount.js",
    ]);
  });

  it("leaves out languages and rarely opened screens", () => {
    const files = shellFiles(bundle);
    expect(files.has("assets/Settings.js")).toBe(false);
    expect(files.has("assets/messages-ar.js")).toBe(false);
  });

  it("filters the workbox list by the shell of the build", () => {
    const { plugin, manifestTransform } = precacheShell();
    plugin.generateBundle({}, bundle);
    const entries = [
      { url: "assets/index.js", revision: null, size: 1 },
      { url: "assets/messages-ar.js", revision: null, size: 1 },
    ];
    expect(manifestTransform(entries).manifest).toEqual([entries[0]]);
  });

  it("leaves out the polyfills, which only old browsers fetch (and keep on first use)", () => {
    const withPolyfills = {
      ...bundle,
      "assets/polyfills-abc.js": chunk("assets/polyfills-abc.js", {
        isEntry: true,
      }),
    };
    expect(shellFiles(withPolyfills).has("assets/polyfills-abc.js")).toBe(
      false,
    );
  });

  it("stops the build when the shell grows past 2,000,000 bytes", () => {
    const { plugin, manifestTransform } = precacheShell();
    plugin.generateBundle({}, bundle);
    expect(() =>
      manifestTransform([
        { url: "assets/index.js", revision: null, size: 1_500_000 },
        { url: "assets/shared.js", revision: null, size: 500_001 },
      ]),
    ).toThrow(/2,000,001 bytes/);
    expect(
      manifestTransform([
        { url: "assets/index.js", revision: null, size: 1_500_000 },
        { url: "assets/shared.js", revision: null, size: 500_000 },
        // outside the shell: not counted
        { url: "assets/messages-ar.js", revision: null, size: 900_000 },
      ]).manifest,
    ).toHaveLength(2);
  });
});
