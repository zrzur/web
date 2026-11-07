import { describe, expect, it } from "vitest";

import { gateHtml, gateScript } from "./polyfillGate.mjs";

const url = "/assets/polyfills-abc.js";

const modern = {
  Iterator: { prototype: { drop: 1, toArray: 1 } },
  Set: { prototype: { union: 1, isSubsetOf: 1 } },
  Array: { prototype: { with: 1 } },
  Uint8Array: { prototype: { toBase64: 1 }, fromBase64: 1 },
  ArrayBuffer: { prototype: { transfer: 1 } },
  JSON: { rawJSON: 1 },
  structuredClone: 1,
};

function run(scope: Record<string, unknown>) {
  let written = "";
  const document = { write: (s: string) => (written += s) };
  const names = Object.keys(scope);
  new Function("document", ...names, gateScript(url))(
    document,
    ...names.map((n) => scope[n]),
  );
  return written;
}

describe("polyfill gate", () => {
  it("loads nothing in a browser that has every feature", () => {
    expect(run(modern)).toBe("");
  });

  it("writes the polyfill tag when a feature is missing", () => {
    expect(run({ ...modern, Uint8Array: { prototype: {} } })).toBe(
      `<script type="module" src="${url}"></script>`,
    );
  });

  it("writes the polyfill tag when a global does not exist", () => {
    expect(run({ ...modern, Iterator: undefined })).toContain(url);
  });

  it("takes the place of the old tag, before the entry", () => {
    const html =
      '<script type="module" crossorigin src="/assets/polyfills-abc.js"></script>' +
      '<script type="module" src="/assets/index.js"></script>';
    expect(gateHtml(html, "/assets/gate.js")).toBe(
      '<script src="/assets/gate.js"></script>' +
        '<script type="module" src="/assets/index.js"></script>',
    );
  });
});
