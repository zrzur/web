import { lingui as linguiSolidPlugin } from "@lingui/vite-plugin";
import devtools from "@solid-devtools/transform";
import legacy from "@vitejs/plugin-legacy";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import babelMacrosPlugin from "vite-plugin-babel-macros";
import Inspect from "vite-plugin-inspect";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import solidSvg from "vite-plugin-solid-svg";

import { assertBuildEnvSafe } from "./buildEnv";
import codegenPlugin from "./codegen.plugin";
import { buildJsonPlugin } from "./scripts/build-json.mjs";
import { dndFlip } from "./scripts/dndFlip.mjs";
import { emitterInspect } from "./scripts/emitterInspect.mjs";
import { polyfillGate } from "./scripts/polyfillGate.mjs";
import { precacheShell } from "./scripts/precacheShell.mjs";
import { preconnectApi } from "./scripts/preconnectApi.mjs";
import { preloadApp } from "./scripts/preloadApp.mjs";
import { buildDefine, readReleaseInfo } from "./scripts/release-info.mjs";
import { siteCatalogs } from "./scripts/siteCatalogs.mjs";
import { thirdPartyNotices } from "./scripts/third-party-notices.mjs";
import { localisedManifests, webManifest } from "./scripts/webManifest.mjs";

// version + git commit + tag of this build; "source code" links use it
const releaseInfo = readReleaseInfo({ dir: resolve(__dirname, "../..") });

const base = process.env.BASE_PATH ?? "/";

const sideEffectModules = /\/components\/ui\/styles\.ts$/;
const isPureSource = (id: string) =>
  /\/packages\/client\/components\/.+\.tsx?$/.test(id) &&
  !sideEffectModules.test(id);
const pwaScope = process.env.PWA_SCOPE || base;

export default defineConfig(({ command }) => {
  assertBuildEnvSafe(command);

  const shell = precacheShell();

  return {
    base,
    define: {
      __ZRZUR_BUILD__: buildDefine(releaseInfo, "web"),
      __ZRZUR_PWA_SCOPE__: JSON.stringify(pwaScope),
    },
    plugins: [
      buildJsonPlugin(releaseInfo, "web"),
      thirdPartyNotices({
        productName: "Zrzur web",
        root: resolve(__dirname, "../.."),
        // shipped but never in the module graph: workspace packages, the
        // service worker (workbox) and the legacy plugin's polyfills
        packages: [
          {
            name: "solid-livekit-components",
            dir: resolve(__dirname, "../solid-livekit-components"),
          },
          { name: "@zrzur/sdk", dir: resolve(__dirname, "../stoat.js") },
          { name: "workbox-precaching" },
          { name: "workbox-core" },
          { name: "workbox-routing" },
          { name: "core-js" },
          // the Discover and Designs servers (packages/public-pages) run
          // from this image and serve this file too
          { name: "@resvg/resvg-js" },
          { name: "@fontsource/ibm-plex-sans-arabic" },
        ],
        extras: [
          {
            // served at /assets/rnnoise/ instead of from jsDelivr
            name: "livekit-rnnoise-processor worklet with RNNoise (WebAssembly)",
            dir: resolve(__dirname, "vendor/rnnoise"),
            license: "Apache-2.0 (RNNoise: BSD-3-Clause)",
            source: "https://github.com/Dadadah/livekit-rnnoise-processor",
            files: ["LICENSE", "SOURCES.md"],
          },
          {
            name: "Phosphor Icons",
            dir: resolve(__dirname, "public/third-party/phosphor"),
            license: "MIT",
            source: "https://github.com/phosphor-icons/core",
          },
          {
            name: "Twemoji graphics (badges and flags)",
            dir: resolve(__dirname, "public/third-party/twemoji"),
            license: "CC-BY-4.0",
            source: "https://github.com/jdecked/twemoji",
          },
          {
            name: "Fluent Emoji artwork",
            dir: resolve(__dirname, "public/emoji/2.2.0"),
            license: "MIT",
            source: "https://github.com/MKAbuMattar/fluentui-emoji",
          },
        ],
      }),
      // Build inspection and Solid devtools instrument every module, which
      // slows the dev server a lot; opt in with ZRZUR_DEVTOOLS=1.
      ...(process.env.ZRZUR_DEVTOOLS ? [Inspect(), devtools()] : []),
      codegenPlugin(),
      // the SDK's event emitter without its 45 KB copy of util.inspect
      emitterInspect(),
      // drag zones measure their rows only after a drag, not on every change
      dndFlip(),
      babelMacrosPlugin(),
      solidPlugin({
        babel: {
          plugins: ["@lingui/babel-plugin-lingui-macro"],
        },
      }),
      linguiSolidPlugin(),
      solidSvg({
        defaultAsComponent: false,
      }),
      legacy({
        // Chrome, Edge and Firefox are set by Uint8Array.prototype.toBase64.
        // Safari stays at 17 on purpose: iPad 6 and similar devices can't update past iPadOS 17
        modernTargets: [
          "chrome >= 140",
          "edge >= 140",
          "firefox >= 133",
          "safari >= 17",
          "ios_saf >= 17",
        ],
        modernPolyfills: true,
        renderLegacyChunks: false,
      }),
      polyfillGate(),
      // the app's files start with the small first file, not after it
      preloadApp(),
      // the API's connection opens while the app's code downloads
      preconnectApi(),
      // the Discover and Designs sites start with only their own messages
      siteCatalogs({
        catalogDir: resolve(__dirname, "components/i18n/catalogs"),
      }),
      shell.plugin,
      VitePWA({
        srcDir: "src",
        registerType: "prompt",
        filename: "serviceWorker.ts",
        strategies: "injectManifest",
        injectManifest: {
          maximumFileSizeToCacheInBytes: 8000000,
          // Emoji artwork loads on demand; do not precache thousands of SVGs at startup.
          globIgnores: ["**/emoji/**"],
          // The Material Symbols fonts (~12 MB) are only a fallback for icons
          // not in our own set; they load on demand instead of on first visit.
          globPatterns: ["**/*.{js,css}"],
          // the shell only, the rest is cached on first use
          manifestTransforms: [shell.manifestTransform],
        },
        // no service worker in the dev server: development does not need it
        // and it adds work to every reload
        devOptions: {
          enabled: false,
          type: "module",
        },
        // registered by src/serviceWorkerInterface.ts, which also decides
        // when a new release takes over (never by reloading on its own)
        injectRegister: false,
        // the worker keeps scripts, styles and fonts only: the icons are
        // read by the system when the app is installed, not by the app
        includeManifestIcons: false,
        // the legacy icon files (android-chrome-*.png) stay on the server
        // for apps installed from an older manifest
        manifest: webManifest({ base, scope: pwaScope }),
      }),
      // manifest.ar.webmanifest: the app is named زرزور on an Arabic device
      localisedManifests({ base, scope: pwaScope }),
    ],
    build: {
      target: "esnext",
      cssTarget: "esnext",
      rollupOptions: {
        external: ["hast"],
        treeshake: {
          // remark-math's HTML half (never used: we render with rehype)
          // reads katex.renderToString on import, which kept all of KaTeX
          // in the first load; KaTeX itself runs nothing on import. Both
          // still load with the first maths message (richPlugins.ts).
          //
          // Our own components have no effect on import, so an unused export
          // of a barrel (@revolt/ui, @revolt/app) must not keep the module:
          // without this the login page shipped every screen. A file that
          // needs its top-level code run by a bare `import "x"` goes in
          // sideEffectModules.
          moduleSideEffects: (id) =>
            !/\/(katex\/dist|micromark-extension-math\/lib\/html\.js)/.test(
              id,
            ) && !isPureSource(id),
        },
        output: {
          // the Markdown parser in its own chunk (it changes less often than
          // the app). Only these modules: the object form also pulled in
          // their dependencies, all of KaTeX among them. Maths and code
          // highlighting load with the first message that needs them.
          manualChunks(id) {
            if (
              /node_modules\/(remark-(breaks|gfm|parse|rehype)|micromark(?!-extension-math)|mdast-util-|vfile)/.test(
                id,
              )
            )
              return "markdown";
          },
        },
      },
      sourcemap: true,
    },
    optimizeDeps: {
      exclude: ["hast"],
    },
    resolve: {
      alias: {
        // the SDK from source; the most specific entry point first
        "@zrzur/sdk/solid/voiceExtras": resolve(
          __dirname,
          "../stoat.js/src/solid/voiceExtras.ts",
        ),
        "@zrzur/sdk/solid": resolve(
          __dirname,
          "../stoat.js/src/solid/index.ts",
        ),
        "@zrzur/sdk/bot": resolve(__dirname, "../stoat.js/src/bot/index.ts"),
        "@zrzur/sdk": resolve(__dirname, "../stoat.js/src/index.ts"),
        "styled-system": resolve(__dirname, "styled-system"),
        ...readdirSync(resolve(__dirname, "components")).reduce(
          (p, f) => ({
            ...p,
            [`@revolt/${f}`]: resolve(__dirname, "components", f),
          }),
          {},
        ),
      },
    },
  };
});
