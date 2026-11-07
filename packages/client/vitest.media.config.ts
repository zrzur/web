import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [
    solid({
      hot: false,
      babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] },
    }),
  ],
  resolve: {
    conditions: ["browser", "development"],
    alias: {
      "@revolt/common": resolve("components/common"),
      "@revolt/ui": resolve("components/ui"),
      "@revolt/client": resolve("components/client"),
      "@revolt/app": resolve("components/app"),
      "@revolt/instance": resolve("components/instance"),
      "@revolt/state": resolve("components/state"),
      "@revolt/markdown": resolve("components/markdown"),
      "@revolt/modal": resolve("components/modal"),
      "@revolt/routing": resolve("components/routing"),
      "styled-system": resolve("styled-system"),
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
