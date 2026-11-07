/**
 * Finds `use:<directive>` placed on a component that does not forward it.
 *
 * Solid only applies `use:` directives on native elements. On a component
 * (including `styled()` ones) it becomes a plain prop and is silently
 * dropped, so a tooltip never shows or a menu never opens. Components that
 * forward directives opt in with `// @codegen directives`.
 *
 * Shared with codegen.plugin.ts, which fails the build on a finding.
 * Run standalone: node scripts/directive-misuse.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Components that forward directives with `// @codegen directives` */
export const FORWARDING = new Set([
  "Button",
  "IconButton",
  "MenuButton",
  "TextField",
  "Symbol",
]);

/**
 * @param {string} src TSX source
 * @param {string[]} directives directive names
 * @returns {{ line: number, component: string, directive: string }[]}
 */
export function findDirectiveMisuse(src, directives) {
  const results = [];
  const open = /<([A-Z][\w.]*)(?=[\s/>])/g;
  const directive = new RegExp(`(^|\\s)use:(${directives.join("|")})\\b`);

  let match;
  while ((match = open.exec(src))) {
    const component = match[1];
    if (FORWARDING.has(component)) continue;

    // collect top-level attribute text up to the end of the opening tag,
    // skipping {...} expressions and string literals
    let depth = 0;
    let quote = null;
    let attrs = "";
    let i = open.lastIndex;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (depth === 0 && c === ">") break;
      if (depth === 0) attrs += c;
    }

    const found = attrs.match(directive);
    if (found) {
      results.push({
        line: src.slice(0, match.index).split("\n").length,
        component,
        directive: found[2],
      });
    }
  }

  return results;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith(".tsx")) yield path;
  }
}

if (process.argv[1]?.endsWith("directive-misuse.mjs")) {
  const directives = readdirSync("./components/ui/directives")
    .filter((x) => x !== "index.ts")
    .map((x) => x.replace(/\.ts$/, ""));
  let count = 0;
  for (const root of ["components", "src"]) {
    for (const file of walk(root)) {
      for (const r of findDirectiveMisuse(
        readFileSync(file, "utf8"),
        directives,
      )) {
        count++;
        console.log(`${file}:${r.line}  <${r.component} use:${r.directive}>`);
      }
    }
  }
  console.log(`${count} finding(s)`);
  process.exitCode = count ? 1 : 0;
}
