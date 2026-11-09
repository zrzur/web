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
  return html.slice(0, match.index) + links + html.slice(match.index);
}

/** Vite plugin */
export function preloadApp() {
  let outDir = "dist";
  let base = "/";
  let files = [];
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
      },
    },
  };
}
