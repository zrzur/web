import { readdirSync } from "node:fs";

import { findDirectiveMisuse } from "./scripts/directive-misuse.mjs";

const fileRegex = /\.tsx$/;
const codegenRegex = /\/\/ @codegen (.*)/g;

const DIRECTIVES = readdirSync("./components/ui/directives")
  .filter((x) => x !== "index.ts")
  .map((x) => x.substring(0, x.length - 3));

const directiveRegex = new RegExp("use:(" + DIRECTIVES.join("|") + ")");

export default function codegenPlugin() {
  return {
    name: "codegen",
    enforce: "pre" as const,
    transform(
      this: { error(message: string): never },
      src: string,
      id: string,
    ) {
      if (fileRegex.test(id)) {
        // use:<directive> on a component that does not forward it is
        // silently dropped (tooltip never shows, menu never opens)
        const misuse = id.includes("node_modules")
          ? []
          : findDirectiveMisuse(src, DIRECTIVES);
        if (misuse.length) {
          this.error(
            misuse
              .map(
                (m) =>
                  `${id}:${m.line} use:${m.directive} on <${m.component}> is ignored. ` +
                  `Put it on a native element (style it with cva/css), or forward it ` +
                  `with "// @codegen directives" and add the component to FORWARDING ` +
                  `in scripts/directive-misuse.mjs.`,
              )
              .join("\n"),
          );
        }

        src = src.replace(codegenRegex, (substring, group1) => {
          const rawArgs: string[] = group1.split(" ");
          const type = rawArgs.shift();

          const args = rawArgs.reduce(
            (d, arg) => {
              const [key, value] = arg.split("=");
              return {
                ...d,
                [key]: value,
              };
            },
            { type },
          ) as {
            type: "directives";
            props?: string;
            include?: string;
          };

          switch (args.type) {
            case "directives": {
              // Generate directives forwarding
              const source = args.props ?? "props";
              const permitted: string[] =
                args.include?.split(",") ?? DIRECTIVES;
              return DIRECTIVES.filter((d) => permitted.includes(d))
                .map((d) => `use:${d}={${source}["use:${d}"]}`)
                .join("\n");
            }
            default:
              return substring;
          }
        });

        if (directiveRegex.test(src)) {
          if (!id.endsWith("client/components/ui/index.tsx"))
            src =
              `import { ${DIRECTIVES.join(
                ", ",
              )} } from "@revolt/ui/directives";\n` + src;
        }

        return src;
      }
    },
  };
}
