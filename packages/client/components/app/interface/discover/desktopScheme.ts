/**
 * The link scheme of the desktop app that belongs to this app: Zrzur Beta
 * registers `zrzur-beta` so it never fights the stable app over `zrzur`
 */
export function desktopScheme(app: string) {
  try {
    return new URL(app).hostname.startsWith("beta.") ? "zrzur-beta" : "zrzur";
  } catch {
    return "zrzur";
  }
}
