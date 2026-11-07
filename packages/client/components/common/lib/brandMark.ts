/**
 * The Zrzur logo (the controller face, version B) for the current
 * mode: white on dark surfaces, ink on light ones. Files come unchanged from the delivered logo package,
 * transparent with no plate.
 */
export function brandMarkSrc(
  darkMode: boolean,
  base: string = import.meta.env.BASE_URL,
): string {
  // ?v= drops the old logo from caches
  return `${base}brand/mark-${darkMode ? "white" : "ink"}.svg?v=b-1`;
}
