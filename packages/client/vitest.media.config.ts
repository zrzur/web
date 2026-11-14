import { lingui } from "@lingui/vite-plugin";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import babelMacrosPlugin from "vite-plugin-babel-macros";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [
    // as in the DOM tests: Lingui macros in .ts files are compiled too
    babelMacrosPlugin(),
    solid({
      hot: false,
      babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] },
    }),
    lingui(),
  ],
  resolve: {
    conditions: ["browser", "development"],
    alias: {
      "styled-system": resolve("styled-system"),
      // every components/<name> as @revolt/<name>, like the DOM tests: a
      // hand-written list missed @revolt/i18n and failed CI
      ...readdirSync(resolve("components")).reduce(
        (p, f) => ({ ...p, [`@revolt/${f}`]: resolve("components", f) }),
        {},
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "test/mediaPicker.spec.ts",
      "test/specialEmbed.spec.ts",
      "test/gifEmbeds.spec.ts",
      "test/emojiPicker.spec.ts",
      "test/emoji-assets.spec.ts",
      "test/customEmojiTooltip.spec.ts",
    ],
  },
});
