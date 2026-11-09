import { lingui } from "@lingui/vite-plugin";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import babelMacrosPlugin from "vite-plugin-babel-macros";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/** Component tests: real Solid components in jsdom (`pnpm run test:dom`). */
export default defineConfig({
  plugins: [
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
      "stoat.js": resolve("../stoat.js/src/index.ts"),
      "styled-system": resolve("styled-system"),
      ...readdirSync(resolve("components")).reduce(
        (p, f) => ({ ...p, [`@revolt/${f}`]: resolve("components", f) }),
        {},
      ),
    },
  },
  test: {
    environment: "jsdom",

    include: ["components/**/*.dom.test.tsx", "src/**/*.dom.test.tsx"],
  },
});
