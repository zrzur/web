import { defineConfig } from "@pandacss/dev";
import Breakpoint from "./components/common/Breakpoint";

const condExt: Record<string, string> = {};

//Load breakpoint conditions
for (const bp in Breakpoint) {
  condExt[bp] = `@media ${Breakpoint[bp as keyof typeof Breakpoint]}`;
}

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],

  // hover styles only where hovering exists: on touch screens :hover sticks to
  // whatever was tapped last (a message, a row) until the next tap elsewhere
  conditions: {
    extend: {
      ...condExt,
      hover: ["@media (hover: hover)", "&:is(:hover, [data-hover])"],
    },
  },

  // Useful for theme customization
  theme: {
    extend: {
      keyframes: {
        zThinking: {
          "0%, 80%, 100%": { opacity: 0.3, transform: "scale(0.8)" },
          "40%": { opacity: 1, transform: "scale(1)" },
        },
        // three birds rising and falling: someone is typing
        zFlock: {
          "0%, 70%, 100%": { transform: "translateY(0)" },
          "35%": { transform: "translateY(-3px)" },
        },
        // settings save bar: leaving was held back by unsaved changes
        zNudge: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" },
        },
        materialPhysicsButtonSelect: {
          "0%": {
            paddingInline: "var(--padding-inline)",
          },
          "50%": {
            paddingInline: "calc(var(--padding-inline) + 8px)",
          },
          "100%": {
            paddingInline: "var(--padding-inline)",
          },
        },
        scrimFadeIn: {
          "0%": {
            background: "transparent",
          },
          "100%": {
            background: "var(--background)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          },
        },
        slideIn: {
          "0%": {
            transform: "translateY(var(--translateY))",
          },
          "100%": {
            transform: "translateY(0px)",
          },
        },
        highlightMessage: {
          "0%": {
            background: "transparent",
          },
          "5%": {
            background: "var(--md-sys-color-primary-container)",
          },
          "95%": {
            background: "var(--md-sys-color-primary-container)",
          },
          "100%": {
            background: "transparent",
          },
        },
        skeletonShimmer: {
          "0%": {
            backgroundPosition: "200% 0",
          },
          "100%": {
            backgroundPosition: "-200% 0",
          },
        },
        // loading placeholders without a gradient: a slow fade
        skeletonPulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.55 },
        },
        authHintIn: {
          "0%": {
            opacity: 0,
            transform: "translateY(4px)",
          },
          "100%": {
            opacity: 1,
            transform: "translateY(0)",
          },
        },
        authDotIn: {
          "0%": {
            opacity: 0,
            transform: "translateY(8px)",
          },
          "100%": {
            opacity: 1,
            transform: "translateY(0)",
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  // Enable jsx code gen
  jsxFramework: "solid",

  hash: true,
  minify: true,
});
