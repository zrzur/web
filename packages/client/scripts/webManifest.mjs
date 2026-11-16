/**
 * The web app manifest: what a phone or computer needs to install Zrzur.
 *
 * One file per name: `manifest.webmanifest` (Zrzur) and
 * `manifest.ar.webmanifest` (زرزور). Both describe the same app (same `id`),
 * so changing the app's language never makes a second installed app; the
 * page links the one that matches its language (components/pwa/manifestLink).
 */

/** Languages with their own manifest file, besides the default */
export const MANIFEST_LOCALES = ["ar"];

const TEXT = {
  en: {
    name: "Zrzur",
    description:
      "Chat and voice for friends and communities: servers, direct messages, calls and screen sharing.",
    messages: "Messages",
    discover: "Discover",
    you: "You",
  },
  ar: {
    name: "زرزور",
    description:
      "محادثة وصوت للأصدقاء والمجتمعات: سيرفرات ورسائل خاصة ومكالمات ومشاركة الشاشة.",
    messages: "الرسائل",
    discover: "اكتشف",
    you: "أنت",
  },
};

/**
 * @param {{ base: string, scope: string, locale?: "en" | "ar" }} options
 */
export function webManifest({ base, scope, locale = "en" }) {
  const text = TEXT[locale];
  const icon = (file) => `${base}assets/web/${file}`;
  const shortcut = (name, path, file) => ({
    name,
    url: `${base}${path}`,
    icons: [{ src: icon(file), type: "image/png", sizes: "96x96" }],
  });

  return {
    // the app's identity: stays the same whatever the start page becomes
    id: base,
    name: text.name,
    short_name: text.name,
    description: text.description,
    lang: locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    categories: ["social", "communication"],
    start_url: base,
    scope,
    // window-controls-overlay: installed on a computer, the title bar is ours
    display_override: ["window-controls-overlay", "standalone"],
    display: "standalone",
    orientation: "any",
    background_color: "#0D0E16",
    theme_color: "#0D0E16",
    // a link opened while the app runs goes to its window, not a second one
    launch_handler: { client_mode: "navigate-existing" },
    prefer_related_applications: false,
    icons: [
      // the official mark (logo B) on Midnight Pulse
      {
        src: icon("zrzur-pwa-192.png"),
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: icon("zrzur-pwa-512.png"),
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: icon("masking-192x192.png"),
        type: "image/png",
        sizes: "192x192",
        purpose: "maskable",
      },
      {
        src: icon("masking-512x512.png"),
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
      {
        src: icon("monochrome.svg"),
        type: "image/svg+xml",
        sizes: "any",
        purpose: "monochrome",
      },
    ],
    shortcuts: [
      shortcut(text.messages, "app", "shortcut-messages.png"),
      shortcut(text.discover, "discover", "shortcut-discover.png"),
      shortcut(text.you, "you", "shortcut-you.png"),
    ],
  };
}

/** Vite plugin: writes the manifest files of the other languages */
export function localisedManifests({ base, scope }) {
  return {
    name: "zrzur-localised-manifests",
    apply: "build",
    generateBundle() {
      for (const locale of MANIFEST_LOCALES)
        this.emitFile({
          type: "asset",
          fileName: `manifest.${locale}.webmanifest`,
          source: JSON.stringify(webManifest({ base, scope, locale })),
        });
    },
  };
}
