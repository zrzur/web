import eslint from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import solid from "eslint-plugin-solid/configs/typescript";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      // minified files
      "**/i18n/catalogs/**",
      "**/i18n/locales/**",

      // build artifacts
      "**/coverage/**",
      "**/dist/**",
      "**/styled-system/**",

      // local agent files and worktrees: ignored by git, other checkouts
      ".claude/**",

      // third-party code kept as published (licence and hashes in vendor/rnnoise/SOURCES.md),
      // and its copy made by scripts/copyAssets.mjs
      "**/vendor/rnnoise/**",
      "**/scripts/assets_fallback/**",

      // submodules, linted in their own repositories
      "packages/stoat.js/**",
      "packages/solid-livekit-components/**",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  solid,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          caughtErrors: "all",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "solid/jsx-no-undef": ["off"],
      "prettier/prettier": ["warn"],
    },
  },
  {
    // native menus look different on every system and ignore the theme:
    // use FloatingSelect + MenuItem from @revolt/ui
    files: ["packages/client/**/*.{ts,tsx}"],
    // a test may build a real <select> to check how code treats one
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          "JSXOpeningElement[name.name='select']",
          "JSXOpeningElement[name.name='option']",
          // the same element behind a wrapper
          "CallExpression[callee.name='styled'][arguments.0.value='select']",
          "MemberExpression[object.name='styled'][property.name='select']",
          "JSXOpeningElement[name.name='Dynamic'] > JSXAttribute[name.name='component'] > Literal[value='select']",
          "CallExpression[callee.property.name='createElement'][arguments.0.value='select']",
        ].map((selector) => ({
          selector,
          message:
            "Use FloatingSelect and MenuItem from @revolt/ui, not a native <select>.",
        })),
      ],
    },
  },
  {
    // scripts, tests, bot examples and the docker entry points run in Node
    files: [
      "**/*.cjs",
      "**/*.mjs",
      "docker/**/*.js",
      "packages/plugin-sdk/bin/**",
      "packages/plugin-sdk/test/**",
    ],
    // Node 22+ also has a global WebSocket
    languageOptions: { globals: { ...globals.node, WebSocket: "readonly" } },
  },
  {
    // Playwright callbacks run in the page
    files: ["e2e/**/*.mjs", "packages/client/e2e/**/*.mjs"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.cjs", "docker/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // the voice gate runs in an AudioWorkletGlobalScope (built from gateKernel by a test)
    files: ["packages/client/public/voice-gate-worklet.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly",
        currentTime: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-this-alias": "off" },
  },
  {
    // plugin code runs in a Web Worker with the `zrzur` API
    files: [
      "packages/plugin-sdk/examples/**/*.js",
      "packages/plugin-sdk/official/**/*.js",
    ],
    languageOptions: { globals: { ...globals.worker, zrzur: "readonly" } },
  },
]);
