/**
 * Hover styles only where hovering exists.
 *
 * On a touch screen ":hover" sticks to whatever was touched last: a sheet
 * opens under the finger and the row there looks selected, a button stays lit
 * after it was pressed. Panda's `_hover` already asks for a device that can
 * hover (panda.config.ts); this does the same for every ":hover" written by
 * hand, in components and in plain CSS files, so no screen has to remember.
 *
 * A rule is split by selector:
 *   a:hover, a:focus-visible { … }
 * becomes
 *   a:focus-visible { … }
 *   @media (hover: hover) { a:hover { … } }
 *
 * and a ":hover" inside a list keeps the rest of the list for touch screens:
 *   row:is(:hover, :focus-within) .tools { … }
 * becomes
 *   row:is(:focus-within) .tools { … }
 *   @media (hover: hover) { row:is(:hover, :focus-within) .tools { … } }
 *
 * ":not(:hover)" says "not hovered", which is always true on touch: such a
 * selector is left as it is.
 */

const HOVER_MEDIA = /hover\s*:\s*hover/;
const LIST = /:(is|where)\(([^()]*)\)/g;

/**
 * What a selector is on a screen that cannot hover.
 * @param {string} selector One selector (no commas at the top level)
 * @returns {string | undefined | null} the same selector when it does not
 *   depend on hovering, another one to keep for touch, null when nothing is left
 */
function withoutHover(selector) {
  if (!selector.includes(":hover")) return selector;
  // "not hovered" holds on touch screens too
  const bare = selector.replace(/:not\([^()]*:hover[^()]*\)/g, "");
  if (!bare.includes(":hover")) return selector;

  // :is(:hover, x, y) keeps x and y
  let listed = true;
  const kept = bare.replace(LIST, (whole, fn, inner) => {
    if (!inner.includes(":hover")) return whole;
    const rest = inner
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !part.includes(":hover"));
    if (!rest.length) {
      listed = false;
      return whole;
    }
    return `:${fn}(${rest.join(", ")})`;
  });
  if (!listed || kept.includes(":hover")) return null;

  // put the ":not(:hover)" parts back as they were
  return selector.replace(LIST, (whole, fn, inner) => {
    if (!inner.includes(":hover")) return whole;
    const rest = inner
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !part.includes(":hover"));
    return rest.length ? `:${fn}(${rest.join(", ")})` : whole;
  });
}

/**
 * @param {string[]} selectors
 * @returns {{ hover: string[], touch: string[] }} what goes inside the hover
 *   media query, and what stays for every screen
 */
function splitHover(selectors) {
  const hover = [];
  const touch = [];
  for (const selector of selectors) {
    const kept = withoutHover(selector);
    if (kept === selector) {
      touch.push(selector);
      continue;
    }
    hover.push(selector);
    if (kept) touch.push(kept);
  }
  return { hover, touch };
}

const plugin = () => ({
  postcssPlugin: "zrzur-hover-only",
  OnceExit(root, { AtRule }) {
    const rules = [];
    root.walkRules((rule) => {
      if (!rule.selector.includes(":hover")) return;
      for (let up = rule.parent; up; up = up.parent) {
        if (up.type !== "atrule") continue;
        if (up.name === "media" && HOVER_MEDIA.test(up.params)) return;
        if (/keyframes$/.test(up.name)) return;
      }
      rules.push(rule);
    });

    for (const rule of rules) {
      const { hover, touch } = splitHover(rule.selectors);
      if (!hover.length) continue;
      const media = new AtRule({ name: "media", params: "(hover: hover)" });
      media.append(rule.clone({ selectors: hover }));
      rule.after(media);
      if (touch.length) rule.selectors = touch;
      else rule.remove();
    }
  },
});
plugin.postcss = true;

module.exports = plugin;
module.exports.splitHover = splitHover;
module.exports.withoutHover = withoutHover;
