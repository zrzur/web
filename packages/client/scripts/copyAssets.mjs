/* eslint-disable no-undef */

import lnk from "lnk";
import { lstat, readdir, readlink, rmdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";

import { copyRnnoise } from "./rnnoiseAssets.mjs";

const publicFolder = resolve("public");
const path = resolve("public", "assets");
const revoltAssets = resolve("assets");
const fallbackAssets = resolve("scripts", "assets_fallback");

/**
 * Create the symlink
 */
async function createSymlink() {
  try {
    await lstat(revoltAssets);
    if ((await readdir(revoltAssets)).length === 0) throw "Empty Directory";
    await lnk(resolve(revoltAssets), resolve(publicFolder), {
      rename: "assets",
    });
    console.info(`Configured Zrzur assets.`);
    return revoltAssets;
  } catch (error) {
    if (error === "Empty Directory" || error.code === "ENOENT") {
      await lnk(resolve(fallbackAssets), resolve(publicFolder), {
        rename: "assets",
      });
      console.info(`Configured fallback assets.`);
      return fallbackAssets;
    } else {
      console.error(error);
      process.exit(-1);
    }
  }
}

try {
  await lstat(path);

  try {
    await readlink(path);
    await unlink(path);
  } catch {
    await rmdir(path);
  }
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error(error);
    process.exit(-1);
  }
}

// the noise filter is served by the app itself: /assets/rnnoise/
const assets = await createSymlink();
console.info(`Noise filter files in ${copyRnnoise(assets)}.`);
