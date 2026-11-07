/**
 * The service worker installs only the shell: the entry, the screens every
 * signed-in person opens, and the files they import. Everything else
 * (languages, settings, Discover, Designs, voice, fonts) is cached the first
 * time it is used, see src/serviceWorker.ts.
 */
const SHELL_SCREENS =
  /\/src\/(Interface|interface\/(Home|ServerHome|channels\/ChannelPage))\.tsx$/;

/** Output files of the shell, from a Rollup output bundle */
export function shellFiles(bundle) {
  const files = new Set();

  const add = (fileName) => {
    if (files.has(fileName)) return;
    files.add(fileName);
    const chunk = bundle[fileName];
    if (chunk?.type !== "chunk") return;
    chunk.imports.forEach(add);
    chunk.viteMetadata?.importedCss.forEach(add);
  };

  for (const chunk of Object.values(bundle)) {
    if (
      chunk.type === "chunk" &&
      (chunk.isEntry || SHELL_SCREENS.test(chunk.facadeModuleId ?? ""))
    )
      add(chunk.fileName);
  }

  return files;
}

/** Remember the shell of this build and filter the precache list by it */
export function precacheShell() {
  let shell = new Set();
  return {
    plugin: {
      name: "zrzur-precache-shell",
      apply: "build",
      generateBundle(_options, bundle) {
        shell = shellFiles(bundle);
      },
    },
    manifestTransform: (entries) => ({
      manifest: entries.filter((entry) => shell.has(entry.url)),
      warnings: [],
    }),
  };
}
