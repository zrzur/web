/** Tutorial sources: the same files the live doc tests run as real bots */
const examples = import.meta.glob(
  "../../../../scripts/bot-api/examples/*.mjs",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
) as Record<string, string>;

export function exampleSource(file: string) {
  return Object.entries(examples).find(([path]) =>
    path.endsWith(`/${file}`),
  )?.[1];
}

export const exampleFiles = () =>
  Object.keys(examples).map((path) => path.split("/").at(-1)!);

/** Names of the fences that insert generated content (see Directives.tsx) */
export const DIRECTIVES = [
  "endpoints",
  "events",
  "types",
  "client-messages",
  "permissions",
  "errors",
  "ratelimits",
  "unsupported",
  "coverage",
  "example",
] as const;
