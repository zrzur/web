// THIRD-PARTY-NOTICES.txt for a Vite build (L-08).
// Collects the licence text of every npm package that ended up in the bundle
// (read from the module graph, so it matches what ships, not what is merely
// installed) plus extra asset folders (fonts, emoji artwork, icon sets).
// Plain Node, no dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const NOTICES_FILE = "THIRD-PARTY-NOTICES.txt";

const LICENSE_FILE = /^(licen[cs]e|copying|notice|unlicense|copyright)([-._].*)?$/i;

/** "/x/node_modules/.pnpm/a@1/node_modules/@s/p/dist/i.js" -> package dir */
export function packageDirOfModule(id) {
  const clean = id.split("?")[0].replace(/\\/g, "/");
  const marker = "/node_modules/";
  const at = clean.lastIndexOf(marker);
  if (at === -1) return null;
  const rest = clean.slice(at + marker.length).split("/");
  const len = rest[0].startsWith("@") ? 2 : 1;
  if (rest.length < len) return null;
  return clean.slice(0, at + marker.length) + rest.slice(0, len).join("/");
}

function licenceFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => LICENSE_FILE.test(f) && statSync(join(dir, f)).isFile())
    .sort();
}

function licenceName(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses))
    return pkg.licenses.map((l) => l.type ?? l).join(" OR ");
  return "UNKNOWN";
}

const MIT = (who) => `MIT License

Copyright (c) ${who}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC = (who) => `ISC License

Copyright (c) ${who}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const REFERENCE = (id, url) =>
  `${id}: the full licence text is at ${url} (this package ships no licence file).`;

const FALLBACKS = {
  MIT,
  ISC,
  "Apache-2.0": (who) =>
    REFERENCE("Apache License 2.0", "https://www.apache.org/licenses/LICENSE-2.0.txt") +
    ` Copyright ${who}.`,
  "BSD-3-Clause": (who) =>
    REFERENCE("BSD 3-Clause License", "https://opensource.org/license/bsd-3-clause") +
    ` Copyright ${who}.`,
};

function authorOf(pkg) {
  const a = pkg.author;
  const name = typeof a === "string" ? a : (a?.name ?? "");
  return name.replace(/\s*[<(].*$/, "").trim() || `the authors of ${pkg.name}`;
}

/**
 * Standard licence text for a package that ships none, picked by its SPDX
 * id(s); "(A AND B)" yields one text per id. Returns [] when none is known.
 */
export function fallbackLicenceTexts(pkg) {
  const ids = licenceName(pkg).split(/[\s()]+|AND|OR/).filter(Boolean);
  const who = authorOf(pkg);
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id) || !FALLBACKS[id]) continue;
    seen.add(id);
    out.push({ file: `(standard ${id} text, package metadata)`, text: FALLBACKS[id](who) });
  }
  return out;
}

/** Read one package directory into a notice entry (null when it is no package) */
export function readPackageNotice(dir) {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  if (!pkg.name) return null;
  const repo =
    typeof pkg.repository === "string"
      ? pkg.repository
      : (pkg.repository?.url ?? pkg.homepage ?? "");
  const texts = licenceFilesIn(dir).map((f) => ({
    file: f,
    text: readFileSync(join(dir, f), "utf8").trim(),
  }));
  return {
    name: pkg.name,
    version: pkg.version ?? "",
    license: licenceName(pkg),
    source: repo,
    texts: texts.length ? texts : fallbackLicenceTexts(pkg),
    fromFallback: texts.length === 0,
  };
}

/** Every installed copy of an npm package under a pnpm/npm workspace root */
export function findInstalled(root, name) {
  const dirs = new Set();
  const direct = join(root, "node_modules", name);
  if (existsSync(join(direct, "package.json"))) dirs.add(direct);
  const store = join(root, "node_modules", ".pnpm");
  if (existsSync(store)) {
    const prefix = name.replace("/", "+") + "@";
    for (const entry of readdirSync(store)) {
      const dir = join(store, entry, "node_modules", name);
      if (entry.startsWith(prefix) && existsSync(join(dir, "package.json")))
        dirs.add(dir);
    }
  }
  return [...dirs].sort();
}

/** An extra (non-npm) component: `files` in `dir`, else every licence/notice/provenance file in it */
export function readExtraNotice(extra) {
  const files = extra.files
    ? extra.files.filter((f) => existsSync(join(extra.dir, f)))
    : existsSync(extra.dir)
    ? readdirSync(extra.dir)
        .filter(
          (f) =>
            /(licen[cs]e|copying|notice|provenance)/i.test(f) &&
            statSync(join(extra.dir, f)).isFile(),
        )
        .sort()
    : [];
  return {
    name: extra.name,
    version: "",
    license: extra.license,
    source: extra.source ?? "",
    texts: files.map((f) => ({
      file: f,
      text: readFileSync(join(extra.dir, f), "utf8").trim(),
    })),
  };
}

/**
 * @param {{ productName: string, entries: ReturnType<typeof readPackageNotice>[] }} input
 */
export function renderNotices({ productName, entries }) {
  const byKey = new Map();
  for (const e of entries) if (e) byKey.set(`${e.name}@${e.version}`, e);
  const sorted = [...byKey.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  );
  const out = [
    `Third-party notices for ${productName}`,
    "",
    `${productName} is free software under the GNU Affero General Public License v3.0 (see LICENSE).`,
    "This file lists the third-party components that are part of this build",
    "and the licence text each one requires us to pass on.",
    "",
    `Components: ${sorted.length}`,
    "",
  ];
  for (const e of sorted) {
    out.push("=".repeat(72));
    out.push(`${e.name}${e.version ? ` ${e.version}` : ""}`);
    out.push(`Licence: ${e.license}`);
    if (e.source) out.push(`Source: ${e.source}`);
    out.push("");
    if (e.texts.length === 0) {
      out.push(
        `(The package ships no licence file; it is published under ${e.license}.)`,
      );
    }
    for (const t of e.texts) {
      out.push(`--- ${t.file} ---`);
      out.push(t.text);
      out.push("");
    }
  }
  return out.join("\n").replace(/\r\n/g, "\n") + "\n";
}

/**
 * Vite/Rollup plugin: emits THIRD-PARTY-NOTICES.txt into the build output.
 * @param {{ productName: string, extras?: {name:string,dir:string,license:string,source?:string,files?:string[]}[],
 *   packages?: { name: string, dir?: string }[], root?: string }} options
 *   packages: components that are shipped but never appear in the module graph
 *   (workspace packages, the service worker's workbox, polyfills); `dir` for
 *   a workspace folder, else looked up by name under `root`. Missing = error.
 */
export function thirdPartyNotices({ productName, extras = [], packages = [], root = process.cwd() }) {
  return {
    name: "zrzur-third-party-notices",
    apply: "build",
    generateBundle(_options, bundle) {
      const dirs = new Set();
      const add = (id) => {
        const dir = packageDirOfModule(id);
        if (dir) dirs.add(dir);
      };
      for (const id of this.getModuleIds()) add(id);
      for (const item of Object.values(bundle)) {
        for (const name of item.originalFileNames ?? []) add(`/${name}`);
        for (const id of Object.keys(item.modules ?? {})) add(id);
      }
      const entries = [];
      for (const dir of dirs) {
        try {
          entries.push(readPackageNotice(dir));
        } catch (e) {
          this.warn(`third-party notices: cannot read ${dir}: ${e.message}`);
        }
      }
      for (const want of packages) {
        const dirsFound = want.dir ? [want.dir] : findInstalled(root, want.name);
        if (dirsFound.length === 0) {
          this.error(`third-party notices: required component ${want.name} is not installed`);
        }
        for (const d of dirsFound) entries.push(readPackageNotice(d));
      }
      for (const extra of extras) {
        const entry = readExtraNotice(extra);
        if (entry.texts.length === 0) {
          this.error(`third-party notices: no licence text found for ${extra.name} in ${extra.dir}`);
        }
        entries.push(entry);
      }
      const missing = entries.filter((e) => e && (e.texts.length === 0 || e.fromFallback));
      if (missing.length)
        this.warn(
          `third-party notices: standard licence text used (no file shipped) for ${missing.map((m) => m.name).join(", ")}`,
        );
      this.emitFile({
        type: "asset",
        fileName: NOTICES_FILE,
        source: renderNotices({ productName, entries }),
      });
    },
  };
}

