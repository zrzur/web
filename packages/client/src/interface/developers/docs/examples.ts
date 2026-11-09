/**
 * Tutorial sources: the same files the live doc tests run as real bots.
 * Each one is its own chunk, loaded by the page that embeds it.
 */
const examples = import.meta.glob<string>(
  "../../../../scripts/bot-api/examples/*.mjs",
  {
    query: "?raw",
    import: "default",
  },
);

const loaded = new Map<string, string>();

const pathOf = (file: string) =>
  Object.keys(examples).find((path) => path.endsWith(`/${file}`));

/** Fetch an example once; undefined when there is no such file */
export async function loadExample(file: string) {
  const path = pathOf(file);
  if (!path) return undefined;
  if (!loaded.has(file)) loaded.set(file, await examples[path]());
  return loaded.get(file);
}

/** Fetch every example a page embeds (` ```example name ` fences) */
export function loadExamplesFor(source: string) {
  return Promise.all(
    [...source.matchAll(/^```example[ \t]+(\S+)/gm)].map(([, file]) =>
      loadExample(file),
    ),
  );
}

/** An example that was loaded before */
export function exampleSource(file: string) {
  return loaded.get(file);
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
