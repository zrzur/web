import { describe, expect, it, vi } from "vitest";

import {
  addPreloads,
  appPreloads,
  preloadApp,
  sitePreloads,
} from "./preloadApp.mjs";

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

/** The two hooks the warning uses, called with a stand-in plugin context */
type Hooks = {
  generateBundle: (this: unknown, options: object, bundle: object) => void;
  closeBundle: (this: unknown) => void;
};

describe("app preload", () => {
  it("lists the app and what it imports, not what the entry already loads", () => {
    expect(appPreloads(bundle)).toEqual([
      "assets/app-b.js",
      "assets/mount.js",
      "assets/core.js",
    ]);
  });

  it("puts the links after the entry script and its stylesheet, with the base path", () => {
    // the first file (and the language file it asks for) comes first:
    // listed after the others, it arrived last on a slow line
    const html =
      '<head>\n  <script type="module" crossorigin src="/zrzur/assets/index-a.js"></script>\n  <link rel="stylesheet" crossorigin href="/zrzur/assets/index-c.css">\n</head>';
    expect(addPreloads(html, ["assets/app-b.js"], "/zrzur/")).toBe(
      '<head>\n  <script type="module" crossorigin src="/zrzur/assets/index-a.js"></script>\n  <link rel="stylesheet" crossorigin href="/zrzur/assets/index-c.css">\n  <link rel="modulepreload" crossorigin href="/zrzur/assets/app-b.js">\n</head>',
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

  it("warns when the build has no src/app.tsx to preload", () => {
    const plugin = preloadApp() as unknown as Hooks;
    const warn = vi.fn();
    plugin.generateBundle.call(
      { warn },
      {},
      {
        "assets/index.js": chunk("assets/index.js", { isEntry: true }),
      },
    );
    plugin.closeBundle.call({ warn });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/app\.tsx/));

    const found = preloadApp() as unknown as Hooks;
    const quiet = vi.fn();
    found.generateBundle.call({ warn: quiet }, {}, bundle);
    found.closeBundle.call({ warn: quiet });
    expect(quiet).not.toHaveBeenCalled();
  });
});

describe("site preloads", () => {
  const sites = Object.fromEntries(
    [
      chunk("assets/index-a.js", {
        isEntry: true,
        imports: ["assets/solid.js"],
      }),
      chunk("assets/solid.js"),
      chunk("assets/app-b.js", {
        facadeModuleId: "/x/packages/client/src/app.tsx",
        imports: ["assets/index-a.js", "assets/chat.js"],
      }),
      chunk("assets/chat.js"),
      chunk("assets/sites-c.js", {
        facadeModuleId: "/x/packages/client/src/sites.tsx",
        imports: ["assets/mount.js"],
      }),
      chunk("assets/mount.js", { imports: ["assets/solid.js"] }),
      chunk("assets/DesignsSite-d.js", {
        facadeModuleId: "/x/packages/client/src/DesignsSite.tsx",
        imports: ["assets/frame.js"],
      }),
      chunk("assets/frame.js"),
      chunk("assets/Designs-e.js", {
        facadeModuleId: "/x/packages/client/src/interface/Designs.tsx",
        imports: ["assets/frame.js", "assets/tiles.js"],
      }),
      chunk("assets/tiles.js"),
      chunk("assets/DiscoverSite-f.js", {
        facadeModuleId: "/x/packages/client/src/DiscoverSite.tsx",
        imports: ["assets/frame.js"],
      }),
      chunk("assets/Discover-g.js", {
        facadeModuleId: "/x/packages/client/src/interface/Discover.tsx",
      }),
      chunk("assets/DevelopersDocs-h.js", {
        facadeModuleId: "/x/packages/client/src/interface/DevelopersDocs.tsx",
      }),
    ].map((c) => [c.fileName, c]),
  );

  it("lists each site's shell and page, never the chat app or the entry's files", () => {
    const lists = sitePreloads(sites);
    expect(lists.designs).toEqual([
      "assets/sites-c.js",
      "assets/mount.js",
      "assets/DesignsSite-d.js",
      "assets/frame.js",
      "assets/Designs-e.js",
      "assets/tiles.js",
    ]);
    expect(lists.discover).toEqual([
      "assets/sites-c.js",
      "assets/mount.js",
      "assets/DiscoverSite-f.js",
      "assets/frame.js",
      "assets/Discover-g.js",
    ]);
    expect(lists.docs).toEqual([
      "assets/sites-c.js",
      "assets/mount.js",
      "assets/DevelopersDocs-h.js",
    ]);
  });

  it("gives no list for a site whose page is not in the build", () => {
    expect(sitePreloads(bundle)).toEqual({});
  });
});
