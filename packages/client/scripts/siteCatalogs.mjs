import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

/**
 * The Discover and Designs sites use about a fifth of the app's messages,
 * but each language file holds all of them (80 KB brotli). This build step
 * writes, per language, a small file with only the messages of the code
 * those sites load: the site pages, what they import, and the pages they
 * open lazily, one step deep. The sites show it first and fetch the full
 * file right after (src/index.tsx, components/i18n/catalog.ts).
 */

export const VIRTUAL_ID = "virtual:zrzur-site-catalogs";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/** Where the sites start */
const SITE_ROOT = /\/src\/sites\.tsx$/;

/** The ids among `keys` that appear as a string in the code */
export function messageKeysIn(code, keys) {
  const found = new Set();
  for (const match of code.matchAll(
    /(["'`])((?:(?!\1)[^\\\n]|\\.){1,300})\1/g,
  )) {
    if (keys.has(match[2])) found.add(match[2]);
  }
  return found;
}

/**
 * Modules the sites run: static imports from the roots, and the modules
 * the roots open lazily (their pages) with their static imports. Deeper lazy
 * parts (sign-in, dialogs) wait for the full file.
 */
export function siteModules(roots, getInfo) {
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    const info = getInfo(id);
    if (!info) return;
    seen.add(id);
    info.importedIds.forEach(walk);
  };
  for (const root of roots) {
    walk(root);
    getInfo(root)?.dynamicallyImportedIds.forEach(walk);
  }
  return seen;
}

/** Fewer messages than this means the scan broke, not that the sites shrank */
const FEWEST_MESSAGES = 50;

/**
 * A broken scan would ship sites that show message ids until the full file
 * arrives: stop the build instead
 */
export function checkSiteCatalog(roots, usedCount) {
  if (roots.length !== 1)
    throw new Error(
      `site catalogs: expected one src/sites.tsx in the build, found ${roots.length}`,
    );
  if (usedCount < FEWEST_MESSAGES)
    throw new Error(
      `site catalogs: only ${usedCount} messages found for the Discover and Designs pages (at least ${FEWEST_MESSAGES} expected)`,
    );
}

/** The catalog with only the used messages */
export function subsetCatalog(messages, used) {
  return Object.fromEntries(
    Object.entries(messages).filter(([key]) => used.has(key)),
  );
}

/** The messages of a compiled catalog (`lingui compile --typescript`) */
export function readCatalog(ts) {
  const start = ts.indexOf('JSON.parse("');
  const end = ts.lastIndexOf('")');
  if (start < 0 || end < start) throw new Error("not a compiled catalog");
  // a JavaScript string literal (it may hold \xA0 and the like, which
  // JSON does not allow); the file is our own build input
  const literal = runInNewContext(`"${ts.slice(start + 12, end)}"`);
  return JSON.parse(literal);
}

/** Vite plugin; `catalogDir` holds one folder per language */
export function siteCatalogs({ catalogDir }) {
  let build = false;
  const languages = existsSync(catalogDir)
    ? readdirSync(catalogDir).filter((code) =>
        existsSync(join(catalogDir, code, "messages.ts")),
      )
    : [];
  const catalogs = new Map();
  const catalog = (code) => {
    if (!catalogs.has(code))
      catalogs.set(
        code,
        readCatalog(
          readFileSync(join(catalogDir, code, "messages.ts"), "utf8"),
        ),
      );
    return catalogs.get(code);
  };
  const keysByModule = new Map();
  let allKeys;
  const refs = new Map();

  return {
    name: "zrzur-site-catalogs",
    enforce: "post",
    configResolved(config) {
      build = config.command === "build";
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      // during development every language loads in full
      if (!build) return "export default {};";
      const lines = languages.map((code) => {
        const ref = this.emitFile({
          type: "asset",
          name: `site-messages-${code}.json`,
        });
        refs.set(code, ref);
        return `  ${JSON.stringify(code)}: import.meta.ROLLUP_FILE_URL_${ref},`;
      });
      return `export default {\n${lines.join("\n")}\n};\n`;
    },
    transform(code, id) {
      if (!build || id.includes("/node_modules/") || id.startsWith("\0"))
        return;
      allKeys ??= new Set(
        languages.flatMap((code) => Object.keys(catalog(code))),
      );
      const keys = messageKeysIn(code, allKeys);
      if (keys.size) keysByModule.set(id.split("?")[0], keys);
    },
    buildEnd(error) {
      if (!build || error || !refs.size) return;
      const roots = [...this.getModuleIds()].filter((id) => SITE_ROOT.test(id));
      const used = new Set();
      for (const id of siteModules(roots, (id) => this.getModuleInfo(id)))
        keysByModule.get(id.split("?")[0])?.forEach((key) => used.add(key));
      try {
        checkSiteCatalog(roots, used.size);
      } catch (problem) {
        this.error(problem.message);
      }
      for (const [code, ref] of refs)
        this.setAssetSource(
          ref,
          JSON.stringify(subsetCatalog(catalog(code), used)),
        );
    },
  };
}
