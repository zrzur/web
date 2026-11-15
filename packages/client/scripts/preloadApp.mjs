import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The first file (src/index.tsx) is small and only then asks for the app.
 * So that this costs no extra round trip, the page asks for the app and the
 * files it imports at the same time as the first file. The Discover and
 * Designs sites share almost all of these files.
 */
const APP = /\/src\/app\.tsx$/;

/** The app chunk and its static imports, minus what the entry loads anyway */
export function appPreloads(bundle) {
  const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
  const app = chunks.find((c) => APP.test(c.facadeModuleId ?? ""));
  if (!app) return [];

  const entryFiles = new Set();
  const walk = (fileName, into) => {
    if (into.has(fileName)) return;
    into.add(fileName);
    bundle[fileName]?.imports?.forEach((f) => walk(f, into));
  };
  for (const c of chunks) if (c.isEntry) walk(c.fileName, entryFiles);

  const files = new Set();
  walk(app.fileName, files);
  return [...files].filter((f) => !entryFiles.has(f));
}

/**
 * The modules each standalone site opens with: its shell (src/sites.tsx),
 * the site's frame and its page. The page itself lists the app's files
 * (above); a site serves its own list instead (public-pages, from
 * site-preloads.json), so its page starts downloading with the first file.
 */
const SITE_ROOTS = {
  designs: [
    /\/src\/sites\.tsx$/,
    /\/src\/DesignsSite\.tsx$/,
    /\/src\/interface\/Designs\.tsx$/,
  ],
  discover: [
    /\/src\/sites\.tsx$/,
    /\/src\/DiscoverSite\.tsx$/,
    /\/src\/interface\/Discover\.tsx$/,
  ],
  docs: [/\/src\/sites\.tsx$/, /\/src\/interface\/DevelopersDocs\.tsx$/],
};

/** Each site's files and what they import, minus what the entry loads */
export function sitePreloads(bundle) {
  const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
  const entryFiles = new Set();
  const walk = (fileName, into) => {
    if (into.has(fileName)) return;
    into.add(fileName);
    bundle[fileName]?.imports?.forEach((f) => walk(f, into));
  };
  for (const c of chunks) if (c.isEntry) walk(c.fileName, entryFiles);

  const lists = {};
  for (const [site, roots] of Object.entries(SITE_ROOTS)) {
    const found = roots.map((root) =>
      chunks.find((c) => root.test(c.facadeModuleId ?? "")),
    );
    if (found.some((c) => !c)) continue;
    const files = new Set();
    for (const c of found) walk(c.fileName, files);
    lists[site] = [...files].filter((f) => !entryFiles.has(f));
  }
  return lists;
}

const ENTRY_TAG =
  /^([ \t]*)<script type="module"[^>]*\ssrc="[^"]*\/assets\/index-[^"]+\.js"[^>]*><\/script>/m;

/** Put modulepreload links for the files before the entry script */
export function addPreloads(html, files, base) {
  const match = ENTRY_TAG.exec(html);
  if (!match || !files.length) return html;
  // the build writes the page once per output (modern and legacy)
  if (html.includes(`href="${base}${files[0]}"`)) return html;
  const indent = match[1];
  const links = files
    .map(
      (f) =>
        `${indent}<link rel="modulepreload" crossorigin href="${base}${f}">\n`,
    )
    .join("");
  const at = afterEntry(html, match);
  return html.slice(0, at) + links + html.slice(at);
}

/**
 * Where the preload links go: after the entry script and the stylesheets
 * right after it. The browser asks for files in this order; listed before
 * the entry, the preloads took the line first and the entry (which asks
 * for the language file) arrived last on a slow phone.
 */
export function afterEntry(html, match) {
  let at = match.index + match[0].length;
  const next = /^\n[ \t]*<link rel="stylesheet"[^>]*>/;
  for (
    let more = next.exec(html.slice(at));
    more;
    more = next.exec(html.slice(at))
  )
    at += more[0].length;
  return html[at] === "\n" ? at + 1 : at;
}

/** Vite plugin */
export function preloadApp() {
  let outDir = "dist";
  let base = "/";
  let files = [];
  let sites = {};
  return {
    name: "zrzur-preload-app",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = config.build.outDir;
      base = config.base;
    },
    generateBundle(_options, bundle) {
      // the legacy build has its own bundle without app.tsx; keep the first
      const found = appPreloads(bundle);
      if (found.length) files = found;
      const lists = sitePreloads(bundle);
      if (Object.keys(lists).length) sites = lists;
    },
    closeBundle() {
      // without it the page loads the app one round trip later: still
      // works, but the speed-up is gone
      if (!files.length)
        this.warn(
          "preload-app: no chunk for src/app.tsx found, index.html gets no app preloads",
        );
    },
    writeBundle: {
      order: "post",
      handler() {
        const htmlPath = join(outDir, "index.html");
        let html;
        try {
          html = readFileSync(htmlPath, "utf8");
        } catch {
          return;
        }
        writeFileSync(htmlPath, addPreloads(html, files, base));
        // for the sites' server (packages/public-pages); docker/inject.js
        // moves the paths into the release folder like any other reference
        writeFileSync(
          join(outDir, "site-preloads.json"),
          JSON.stringify(sites, null, 1) + "\n",
        );
      },
    },
  };
}
