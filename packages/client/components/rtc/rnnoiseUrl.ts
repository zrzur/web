/**
 * Folder with the noise filter's worklet and WebAssembly (`RNNoiseWorklet.js`,
 * `rnnoise.wasm`). By default the app's own copy at `<base>assets/rnnoise/`
 * (vendor/rnnoise, copied by scripts/copyAssets.mjs): no script from a public
 * CDN. `VITE_RNNOISE_WORKLET_CDN_URL` still replaces it.
 *
 * The loader builds `new URL(folder + file)`, so the folder is absolute and
 * ends with "/".
 */
export function rnnoiseFolder(
  configured: string | undefined,
  base: string,
  page: string,
): string {
  if (configured && configured.endsWith("/")) return configured;
  const path = `${base.endsWith("/") ? base : `${base}/`}assets/rnnoise/`;
  return new URL(path, page).href;
}
