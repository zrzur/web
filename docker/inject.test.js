// node --test docker/inject.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { inject } = require("./inject.js");

/** A tiny build that looks like Vite's output */
function fakeBuild() {
  const root = mkdtempSync(join(tmpdir(), "zrzur-inject-"));
  const dist = join(root, "dist");
  mkdirSync(join(dist, "assets", "web"), { recursive: true });
  writeFileSync(
    join(dist, "index.html"),
    '<link href="/assets/web/icon.png?v=1"><script src="/assets/index-AAAA1111.js"></script><link href="/assets/index-CCCC3333.css">',
  );
  writeFileSync(
    join(dist, "assets", "index-AAAA1111.js"),
    'const ws="__VITE_WS_URL__";const api="__VITE_API_URL__";const gif="__VITE_GIFBOX_URL__";' +
      'const deps=["assets/chunk-BBBB2222.js","assets/index-CCCC3333.css"];import("./chunk-BBBB2222.js");' +
      'const icon="/assets/web/icon.png";',
  );
  writeFileSync(join(dist, "assets", "chunk-BBBB2222.js"), 'export const x=1;');
  writeFileSync(join(dist, "assets", "index-CCCC3333.css"), 'body{background:url(/assets/web/icon.png)}');
  writeFileSync(join(dist, "assets", "web", "icon.png"), "png");
  writeFileSync(
    join(dist, "serviceWorker.js"),
    'precacheAndRoute([{"revision":null,"url":"assets/index-AAAA1111.js"},{"revision":null,"url":"assets/chunk-BBBB2222.js"}]);',
  );
  return { root, dist };
}

const ENV = {
  VITE_HOST: "app.zrzur.com",
  VITE_API_URL: "https://api.zrzur.com",
  VITE_DEV_WS_URL: "wss://events.zrzur.com",
};

function run(dist, root, env, name = "out") {
  const outDir = join(root, name);
  const result = inject({ buildDir: dist, outDir, env, log: () => {} });
  return { ...result, outDir, read: (p) => readFileSync(join(outDir, p), "utf-8") };
}

test("emitted files move to assets/<release>/ and every reference follows", () => {
  const { root, dist } = fakeBuild();
  const out = run(dist, root, ENV);

  assert.match(out.release, /^[0-9a-f]{12}$/);
  assert.equal(out.moved, 3);
  for (const name of ["index-AAAA1111.js", "chunk-BBBB2222.js", "index-CCCC3333.css"]) {
    assert.ok(existsSync(join(out.outDir, "assets", out.release, name)), name);
    assert.ok(!existsSync(join(out.outDir, "assets", name)), `${name} left behind`);
  }

  const html = out.read("index.html");
  assert.ok(html.includes(`/assets/${out.release}/index-AAAA1111.js`));
  assert.ok(html.includes(`/assets/${out.release}/index-CCCC3333.css`));

  const js = out.read(`assets/${out.release}/index-AAAA1111.js`);
  assert.ok(js.includes(`"assets/${out.release}/chunk-BBBB2222.js"`), "preload list");
  assert.ok(js.includes('import("./chunk-BBBB2222.js")'), "relative import stays");

  const sw = out.read("serviceWorker.js");
  assert.ok(sw.includes(`"url":"assets/${out.release}/index-AAAA1111.js"`));
  assert.ok(!sw.includes('"url":"assets/index-AAAA1111.js"'));
});

test("files in sub-folders of assets/ keep their addresses", () => {
  const { root, dist } = fakeBuild();
  const out = run(dist, root, ENV);
  assert.ok(existsSync(join(out.outDir, "assets", "web", "icon.png")));
  assert.ok(out.read("index.html").includes("/assets/web/icon.png?v=1"));
  assert.ok(out.read(`assets/${out.release}/index-AAAA1111.js`).includes('"/assets/web/icon.png"'));
  assert.ok(out.read(`assets/${out.release}/index-CCCC3333.css`).includes("url(/assets/web/icon.png)"));
});

test("values are written in; an unset value becomes undefined", () => {
  const { root, dist } = fakeBuild();
  const out = run(dist, root, ENV);
  const js = out.read(`assets/${out.release}/index-AAAA1111.js`);
  assert.ok(js.includes('const ws="wss://events.zrzur.com"'));
  assert.ok(js.includes('const api="https://api.zrzur.com"'));
  assert.ok(js.includes("const gif=void 0"));
  assert.ok(!js.includes("__VITE_"));
});

test("same build and URLs give the same release; a changed URL gives a new one", () => {
  const { root, dist } = fakeBuild();
  const a = run(dist, root, ENV, "a");
  const b = run(dist, root, ENV, "b");
  const c = run(dist, root, { ...ENV, VITE_DEV_WS_URL: "wss://ws.zrzur.com" }, "c");
  assert.equal(a.release, b.release);
  assert.notEqual(a.release, c.release);
  // the service worker's bytes change too, so browsers install the new one
  assert.notEqual(a.read("serviceWorker.js"), c.read("serviceWorker.js"));
});
