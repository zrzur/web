import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Browsers that already have everything skip the polyfills. A browser missing
 * any of these gets the whole polyfill file, as every browser did before.
 * A new language feature that build targets don't all have goes in this list.
 */
export const REQUIRED_FEATURES = [
  "Iterator.prototype.drop",
  "Iterator.prototype.toArray",
  "Set.prototype.union",
  "Set.prototype.isSubsetOf",
  "Array.prototype.with",
  "Uint8Array.prototype.toBase64",
  "Uint8Array.fromBase64",
  "ArrayBuffer.prototype.transfer",
  "JSON.rawJSON",
  "structuredClone",
];

const POLYFILL_TAG =
  /<script type="module"[^>]*\bsrc="([^"]*\/polyfills-[^"]+\.js)"[^>]*><\/script>/;

/** A small classic script: it writes the polyfill tag only when needed */
export function gateScript(polyfillUrl) {
  const checks = REQUIRED_FEATURES.join("&&");
  const tag = `<script type="module" src="${polyfillUrl}"><\\/script>`;
  return `try{if(!(${checks}))throw 0}catch(e){document.write('${tag}')}\n`;
}

/** Swap the polyfill script tag for the tag of the gate script */
export function gateHtml(html, gateUrl) {
  return html.replace(POLYFILL_TAG, `<script src="${gateUrl}"></script>`);
}

/**
 * Vite plugin. The gate takes the place of the old tag: module scripts run in
 * document order, so the polyfills still run before the app.
 */
export function polyfillGate() {
  let outDir = "dist";
  return {
    name: "zrzur-polyfill-gate",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle: {
      order: "post",
      handler() {
        const htmlPath = join(outDir, "index.html");
        const html = readFileSync(htmlPath, "utf8");
        const url = POLYFILL_TAG.exec(html)?.[1];
        if (!url) return;
        const script = gateScript(url);
        const hash = createHash("sha256").update(script).digest("hex");
        const file = `gate-${hash.slice(0, 8)}.js`;
        writeFileSync(join(outDir, "assets", file), script);
        writeFileSync(htmlPath, gateHtml(html, url.replace(/[^/]+$/, file)));
      },
    },
  };
}
