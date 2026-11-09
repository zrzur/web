/**
 * The service worker installs only the shell: the entry, the app it loads
 * (src/app.tsx; not the Discover and Designs sites), the screens every
 * signed-in person opens, and the files they import. Everything else
 * (languages, settings, Discover, Designs, voice, fonts) is cached the first
 * time it is used, see src/serviceWorker.ts.
 */
const SHELL_SCREENS =
  /\/src\/(app|Interface|interface\/(Home|ServerHome|channels\/ChannelPage))\.tsx$/;

/**
 * The polyfills: only browsers missing a feature fetch them (through the
 * gate, scripts/polyfillGate.mjs), and the service worker keeps them on
 * that first use like any other file
 */
const POLYFILLS = /(^|\/)polyfills-[^/]+\.js$/;

/** The most the shell may weigh: the service worker installs all of it */
const MAX_SHELL_BYTES = 2_000_000;

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
      !POLYFILLS.test(chunk.fileName) &&
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
    manifestTransform: (entries) => {
      const manifest = entries.filter((entry) => shell.has(entry.url));
      const bytes = manifest.reduce((sum, entry) => sum + entry.size, 0);
      if (bytes > MAX_SHELL_BYTES)
        throw new Error(
          `precache shell is ${bytes.toLocaleString("en")} bytes, over ${MAX_SHELL_BYTES.toLocaleString("en")}: make a rarely used import lazy or leave a file out (scripts/precacheShell.mjs)`,
        );
      return { manifest, warnings: [] };
    },
  };
}
