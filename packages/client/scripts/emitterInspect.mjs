/**
 * The SDK's event emitter (@vladfrangu/async_event_emitter) bundles a full
 * copy of Node's util.inspect (node-inspect-extracted), about 45 KB minified
 * in the first-load chunk. The emitter uses it in one place only: the text
 * of the error thrown when an "error" event that is not an Error has no
 * listener. This build step swaps the copy for a small function that gives
 * the same kind of text; the emitter itself is unchanged.
 */

export const EMITTER_FILE =
  /\/@vladfrangu\/async_event_emitter\/dist\/index\.mjs$/;

const START = "// node_modules/node-inspect-extracted/dist/inspect.js";
const END = "} = import_inspect.default;";

const SMALL_INSPECT = `// the util.inspect copy was removed by the Zrzur build (scripts/emitterInspect.mjs)
var inspect = (value) => {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
};`;

/** The emitter's source without the util.inspect copy */
export function stripEmitterInspect(code) {
  const start = code.indexOf(START);
  const end = code.indexOf(END);
  if (start < 0 || end < start)
    throw new Error(
      "@vladfrangu/async_event_emitter changed: update scripts/emitterInspect.mjs",
    );
  // the licence note of the removed copy goes with it
  const rest = code
    .slice(end + END.length)
    .replace(
      /\/\*! Bundled license information:\s*node-inspect-extracted\/dist\/inspect\.js:\s*\(\*![^\n]*\*\)\s*\*\/\n?/,
      "",
    );
  // the library's source map no longer matches the code
  return (code.slice(0, start) + SMALL_INSPECT + rest).replace(
    /\n\/\/# sourceMappingURL=\S+\s*$/,
    "\n",
  );
}

/** Vite plugin */
export function emitterInspect() {
  return {
    name: "zrzur-emitter-inspect",
    enforce: "pre",
    transform(code, id) {
      if (!EMITTER_FILE.test(id.replace(/\\/g, "/").split("?")[0])) return;
      return { code: stripEmitterInspect(code), map: null };
    },
  };
}
