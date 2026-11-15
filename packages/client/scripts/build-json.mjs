// The public /build.json of the web build: what runs at this address, for the
// /source page on zrzur.com (AGPL section 13). zrzur.com reads it at runtime,
// so the page names the deployed commit, not the one the website was built
// with. Web only; release-info.mjs stays the shared copy.
import { sourceUrl } from "./release-info.mjs";

/** The file's text for a build */
export function buildJson(info, repo) {
  const body = {
    product: "Zrzur",
    component: repo,
    version: info.version,
    commit: info.commit,
    tag: info.tag,
    sourceUrl: sourceUrl(info, repo),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

/** Vite plugin: writes build.json next to index.html */
export function buildJsonPlugin(info, repo) {
  return {
    name: "zrzur-build-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build.json",
        source: buildJson(info, repo),
      });
    },
  };
}
