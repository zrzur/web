/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  plugins: [
    require("@pandacss/dev/postcss")(),
    // every ":hover" only where hovering exists (touch screens keep it stuck)
    require("./scripts/postcssHoverOnly.cjs")(),
  ],
};
