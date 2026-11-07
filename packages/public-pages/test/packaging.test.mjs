import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the image's npm ci has a lockfile in step with package.json", () => {
  const pkg = JSON.parse(file("../package.json"));
  const lock = JSON.parse(file("../package-lock.json"));
  assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
  assert.equal(lock.packages["node_modules/@resvg/resvg-js"].version, pkg.dependencies["@resvg/resvg-js"]);
});

test("the lockfile has the native renderer for the Alpine image", () => {
  const lock = JSON.parse(file("../package-lock.json"));
  for (const arch of ["x64", "arm64"]) {
    assert.ok(lock.packages[`node_modules/@resvg/resvg-js-linux-${arch}-musl`], arch);
  }
});

test("every package the image build filters on exists in the workspace", () => {
  const known = ["../../client", "../../stoat.js", "../../solid-livekit-components"].map(
    (dir) => JSON.parse(file(`${dir}/package.json`)).name,
  );
  const filters = [
    ...file("../../../Dockerfile").matchAll(/pnpm --filter (\S+)/g),
    ...file("../../../.github/workflows/images.yml").matchAll(/pnpm --filter (\S+)/g),
  ].map((m) => m[1]);
  assert.ok(filters.length > 0);
  for (const name of filters) assert.ok(known.includes(name), name);
});

test("the served licence notices name the renderer and the preview font", () => {
  const config = file("../../client/vite.config.ts");
  assert.match(config, /name: "@resvg\/resvg-js"/);
  assert.match(config, /name: "@fontsource\/ibm-plex-sans-arabic"/);
});
